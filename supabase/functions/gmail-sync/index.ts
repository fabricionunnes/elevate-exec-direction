// gmail-sync: e-mail dentro do Nexus (05/11/2026). Sincroniza a caixa do Gmail de cada usuário pro banco
// (mail_accounts / mail_labels / mail_messages) e executa as ações da tela (ler corpo, anexo, marcar,
// arquivar, lixeira, enviar, buscar). Usa o mesmo OAuth do Google que o time já conecta pro Calendar
// (user_google_tokens), com o escopo gmail.modify pedido no google-calendar?action=auth-url.
//
// Chamadas:
//   cron (service role)  {mode:"sync"}            → todas as caixas: incremental (historyId) + carga inicial em lotes
//   usuário (JWT)        {action:"connect"}        → cria/ativa a própria caixa (precisa do escopo do Gmail)
//                        {action:"status"}
//                        {action:"sync-me"}
//                        {action:"message", gmail_id}
//                        {action:"attachment", gmail_id, attachment_id}
//                        {action:"modify", gmail_ids:[], add:[], remove:[]}   (UNREAD, STARRED, INBOX, TRASH...)
//                        {action:"send", to, cc, bcc, subject, html, text, thread_id?, in_reply_to?, references?, attachments?}
//                        {action:"search", q}
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const DIAS_CARGA_INICIAL = 90;
const PAGINAS_POR_PASSADA = 2; // carga inicial: 2 páginas de 50 por caixa a cada minuto
const ORCAMENTO_MS = 50_000;
// Push do Gmail (06/11/2026, Fabrício: "queria que os emails chegassem na hora"): o Google publica num
// tópico Pub/Sub a cada mudança na caixa e o Pub/Sub chama esta function (?push=<GMAIL_PUSH_TOKEN>).
// O watch vale 7 dias; o modo "watch" (cron diário) renova.
const GMAIL_PUSH_TOPIC = Deno.env.get("GMAIL_PUSH_TOPIC") || "projects/composite-fire-496222-s4/topics/gmail-push";
const GMAIL_PUSH_TOKEN = Deno.env.get("GMAIL_PUSH_TOKEN") || ""; // opcional: se definido, exige ?push=<token>
const GMAIL_PUSH_SUBSCRIPTION = Deno.env.get("GMAIL_PUSH_SUBSCRIPTION") || "projects/composite-fire-496222-s4/subscriptions/gmail-push-nexus";

const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

class NeedsAuth extends Error {}

// ── Token Google (renova e persiste, igual ao sync-all-recordings) ─────────────────────────────
async function tokenDoUsuario(userId: string): Promise<string> {
  const { data: t } = await supabase.from("user_google_tokens").select("*").eq("user_id", userId).maybeSingle();
  if (!t) throw new NeedsAuth("Google não conectado");
  if (t.token_expires_at && new Date(t.token_expires_at).getTime() > Date.now() + 60_000) return t.access_token;
  if (!t.refresh_token || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new NeedsAuth("Token expirado, reconecte o Google");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: t.refresh_token, grant_type: "refresh_token" }),
  });
  if (!r.ok) throw new NeedsAuth("Não consegui renovar o token do Google, reconecte");
  const d = await r.json();
  await supabase.from("user_google_tokens").update({ access_token: d.access_token, token_expires_at: new Date(Date.now() + (d.expires_in || 3600) * 1000).toISOString() }).eq("user_id", userId);
  return d.access_token;
}

// deno-lint-ignore no-explicit-any
async function gmail(token: string, path: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(`${GMAIL}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  if (r.status === 401) throw new NeedsAuth("Google recusou o token");
  if (r.status === 403) {
    const t = await r.text();
    if (/insufficient|scope/i.test(t)) throw new NeedsAuth("Sem permissão do Gmail: reconecte o Google no Nexus");
    throw new Error(`Gmail 403: ${t.slice(0, 200)}`);
  }
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Gmail ${r.status}: ${(await r.text()).slice(0, 300)}`);
  if (r.status === 204) return {};
  return await r.json();
}

// ── Parse da mensagem ──────────────────────────────────────────────────────────────────────────
const b64url = (s: string) => {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm + "===".slice((norm.length + 3) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
};
const toB64url = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
type Addr = { name: string; email: string };
function parseAddrs(h: string | undefined): Addr[] {
  if (!h) return [];
  const out: Addr[] = [];
  const parts: string[] = []; let cur = "", q = false, ang = 0;
  for (const ch of h) {
    if (ch === '"') q = !q;
    if (ch === "<") ang++; if (ch === ">") ang = Math.max(0, ang - 1);
    if (ch === "," && !q && ang === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  parts.push(cur);
  for (const p of parts) {
    const s = p.trim(); if (!s) continue;
    const m = s.match(/^(.*?)<([^>]+)>\s*$/);
    if (m) out.push({ name: m[1].trim().replace(/^"|"$/g, ""), email: m[2].trim().toLowerCase() });
    else out.push({ name: "", email: s.replace(/^"|"$/g, "").toLowerCase() });
  }
  return out;
}
// deno-lint-ignore no-explicit-any
function headersMap(payload: any): Record<string, string> {
  const m: Record<string, string> = {};
  for (const h of payload?.headers || []) m[String(h.name).toLowerCase()] = h.value;
  return m;
}
// deno-lint-ignore no-explicit-any
type Parsed = { html: string | null; text: string | null; attachments: any[] };
// deno-lint-ignore no-explicit-any
function walk(part: any, acc: Parsed) {
  if (!part) return;
  const mime = String(part.mimeType || "");
  const filename = part.filename || "";
  const body = part.body || {};
  const hdr = headersMap(part);
  const cid = (hdr["content-id"] || "").replace(/^<|>$/g, "");
  if (filename || (body.attachmentId && !/^text\//.test(mime))) {
    acc.attachments.push({ attachmentId: body.attachmentId || null, filename: filename || `anexo.${mime.split("/")[1] || "bin"}`, mimeType: mime, size: body.size || 0, contentId: cid || null, inline: !!cid && /inline/i.test(hdr["content-disposition"] || "") });
  } else if (mime === "text/html" && body.data) {
    acc.html = (acc.html || "") + b64url(body.data);
  } else if (mime === "text/plain" && body.data) {
    acc.text = (acc.text || "") + b64url(body.data);
  }
  for (const p of part.parts || []) walk(p, acc);
}
// deno-lint-ignore no-explicit-any
function linhaDaMensagem(accountId: string, m: any, full: boolean) {
  const h = headersMap(m.payload);
  const from = parseAddrs(h["from"])[0] || { name: "", email: "" };
  const labels: string[] = m.labelIds || [];
  const row: Record<string, unknown> = {
    account_id: accountId, gmail_id: m.id, thread_id: m.threadId, label_ids: labels,
    from_name: from.name || null, from_email: from.email || null,
    to_list: parseAddrs(h["to"]), cc_list: parseAddrs(h["cc"]), bcc_list: parseAddrs(h["bcc"]),
    reply_to: h["reply-to"] || null, subject: h["subject"] || "(sem assunto)", snippet: m.snippet || "",
    internal_date: new Date(Number(m.internalDate || Date.now())).toISOString(),
    is_unread: labels.includes("UNREAD"), is_starred: labels.includes("STARRED"), is_sent: labels.includes("SENT"),
    message_id_header: h["message-id"] || null, references_header: h["references"] || null,
    size_estimate: m.sizeEstimate || null, updated_at: new Date().toISOString(),
  };
  if (full) {
    const acc: Parsed = { html: null, text: null, attachments: [] };
    walk(m.payload, acc);
    row.body_html = acc.html; row.body_text = acc.text; row.attachments = acc.attachments;
    row.has_attachments = acc.attachments.some((a) => !a.inline);
    row.body_loaded = true;
  }
  return row;
}
const META = "format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Bcc&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID&metadataHeaders=References&metadataHeaders=Reply-To";

async function buscarEGravar(token: string, accountId: string, ids: string[], full = false) {
  let n = 0;
  for (const id of ids) {
    const m = await gmail(token, `/messages/${id}?${full ? "format=full" : META}`);
    if (!m) continue;
    const row = linhaDaMensagem(accountId, m, full);
    const { error } = await supabase.from("mail_messages").upsert(row, { onConflict: "account_id,gmail_id", ignoreDuplicates: false });
    if (error) console.error("upsert msg", id, error.message); else n++;
  }
  return n;
}

// ── Sincronização de uma caixa ────────────────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function sincronizarCaixa(acc: any, inicio: number): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { email: acc.email };
  const token = await tokenDoUsuario(acc.user_id);

  // 1) marco inicial: guarda o historyId ANTES da carga inicial pra não perder nada no meio
  if (!acc.history_id) {
    const prof = await gmail(token, "/profile");
    await supabase.from("mail_accounts").update({ history_id: String(prof.historyId), email: prof.emailAddress }).eq("id", acc.id);
    acc.history_id = String(prof.historyId);
  }

  // 2) incremental pelo histórico
  let hist = await gmail(token, `/history?startHistoryId=${acc.history_id}&historyTypes=messageAdded&historyTypes=messageDeleted&historyTypes=labelAdded&historyTypes=labelRemoved&maxResults=500`);
  if (hist === null) {
    // historyId velho demais: reancora e recupera os últimos 3 dias pela lista
    const prof = await gmail(token, "/profile");
    const lista = await gmail(token, `/messages?q=newer_than:3d&maxResults=100`);
    // deno-lint-ignore no-explicit-any
    await buscarEGravar(token, acc.id, (lista?.messages || []).map((m: any) => m.id));
    await supabase.from("mail_accounts").update({ history_id: String(prof.historyId) }).eq("id", acc.id);
    out.reancorado = true;
  } else {
    const novos = new Set<string>(); const apagados = new Set<string>(); const relabel = new Map<string, Set<string>>();
    let ultimo = acc.history_id;
    while (hist) {
      for (const h of hist.history || []) {
        for (const a of h.messagesAdded || []) novos.add(a.message.id);
        for (const d of h.messagesDeleted || []) { apagados.add(d.message.id); novos.delete(d.message.id); }
        for (const l of [...(h.labelsAdded || []), ...(h.labelsRemoved || [])]) relabel.set(l.message.id, new Set(l.message.labelIds || []));
      }
      if (hist.historyId) ultimo = String(hist.historyId);
      if (!hist.nextPageToken) break;
      hist = await gmail(token, `/history?startHistoryId=${acc.history_id}&pageToken=${hist.nextPageToken}&maxResults=500`);
    }
    for (const id of apagados) await supabase.from("mail_messages").delete().eq("account_id", acc.id).eq("gmail_id", id);
    out.novas = await buscarEGravar(token, acc.id, [...novos].filter((id) => !apagados.has(id)));
    let rel = 0;
    for (const [id, labels] of relabel) {
      if (novos.has(id) || apagados.has(id)) continue;
      const arr = [...labels];
      const { data } = await supabase.from("mail_messages").update({ label_ids: arr, is_unread: arr.includes("UNREAD"), is_starred: arr.includes("STARRED"), updated_at: new Date().toISOString() })
        .eq("account_id", acc.id).eq("gmail_id", id).select("id");
      if (data?.length) rel++;
      else if (!arr.includes("TRASH") && !arr.includes("SPAM")) await buscarEGravar(token, acc.id, [id]);
    }
    out.rotulos = rel;
    if (ultimo !== acc.history_id) await supabase.from("mail_accounts").update({ history_id: ultimo }).eq("id", acc.id);
  }

  // 3) carga inicial em lotes (mais recentes primeiro, 90 dias)
  if (!acc.backfill_done && Date.now() - inicio < ORCAMENTO_MS) {
    const depois = acc.backfill_after || new Date(Date.now() - DIAS_CARGA_INICIAL * 86400_000).toISOString().slice(0, 10);
    let pageToken = acc.backfill_page_token || "";
    let carregadas = 0;
    for (let p = 0; p < PAGINAS_POR_PASSADA && Date.now() - inicio < ORCAMENTO_MS; p++) {
      const q = encodeURIComponent(`after:${depois.replace(/-/g, "/")} -in:chats`);
      const lista = await gmail(token, `/messages?q=${q}&maxResults=50&includeSpamTrash=false${pageToken ? `&pageToken=${pageToken}` : ""}`);
      // deno-lint-ignore no-explicit-any
      const ids: string[] = (lista?.messages || []).map((m: any) => m.id);
      const { data: jaTem } = ids.length ? await supabase.from("mail_messages").select("gmail_id").eq("account_id", acc.id).in("gmail_id", ids) : { data: [] };
      // deno-lint-ignore no-explicit-any
      const faltam = ids.filter((id) => !(jaTem || []).some((r: any) => r.gmail_id === id));
      carregadas += await buscarEGravar(token, acc.id, faltam);
      pageToken = lista?.nextPageToken || "";
      if (!pageToken) {
        await supabase.from("mail_accounts").update({ backfill_done: true, backfill_page_token: null, backfill_after: depois }).eq("id", acc.id);
        out.carga_inicial = "concluída";
        break;
      }
      await supabase.from("mail_accounts").update({ backfill_page_token: pageToken, backfill_after: depois }).eq("id", acc.id);
    }
    out.carregadas = carregadas;
  }

  // 4) rótulos (nomes)
  try {
    const lbl = await gmail(token, "/labels");
    // deno-lint-ignore no-explicit-any
    const rows = (lbl?.labels || []).map((l: any) => ({ account_id: acc.id, gmail_label_id: l.id, name: l.name, type: l.type, color: l.color?.backgroundColor || null }));
    if (rows.length) await supabase.from("mail_labels").upsert(rows, { onConflict: "account_id,gmail_label_id" });
  } catch (e) { console.error("labels", acc.email, e); }

  await supabase.from("mail_accounts").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("id", acc.id);
  return out;
}

// ── Tradução pra português (06/11/2026, Fabrício: "todos os e-mails em outro idioma apareçam em português") ──
// Detector local resolve quem já está em português sem IA; o resto vai pro Claude Haiku (o mais barato),
// lista em lote de até 20 numa chamada e o corpo só quando a mensagem é aberta. Tudo fica em cache no banco.
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY") || "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const MODELO_TRADUCAO = "claude-haiku-5-5";
const MODELO_OPENAI = "gpt-4o-mini"; // principal: mais barato; Claude Haiku fica de reserva
const PT = /\b(de|que|não|nao|para|com|uma|você|voce|seu|sua|está|esta|são|sao|mais|pelo|pela|nós|obrigad[oa]|olá|ola|prezad[oa]|então|também|agora|sobre|isso|aqui)\b|ção|ções|ão\b/gi;
const OUTRO = /\b(the|and|you|your|to|of|is|are|for|with|this|that|have|will|from|our|please|thanks|hello|el|los|las|usted|gracias|hola|und|der|die|das|nicht|vous|nous|avec|pour|est)\b/gi;
function idiomaLocal(texto: string): "pt" | null {
  const t = (texto || "").slice(0, 1500);
  const pt = (t.match(PT) || []).length, outro = (t.match(OUTRO) || []).length;
  if (pt >= 3 && pt >= outro * 1.5) return "pt";
  return null;
}
const semHtml = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<br\s*\/?>(?!\n)/gi, "\n").replace(/<\/(p|div|tr|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();

async function openai(prompt: string, maxTokens: number, meta: Record<string, unknown>): Promise<string> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: MODELO_OPENAI, max_tokens: maxTokens, temperature: 0.2, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error(`Tradução falhou (OpenAI ${r.status}): ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  supabase.from("ai_usage_log").insert({ fn: "gmail-sync", model: MODELO_OPENAI, input_tokens: d.usage?.prompt_tokens || 0, output_tokens: d.usage?.completion_tokens || 0, cache_read_tokens: d.usage?.prompt_tokens_details?.cached_tokens || 0, cache_write_tokens: 0, meta }).then(() => {}, () => {});
  return String(d.choices?.[0]?.message?.content || "").trim();
}

// Gemini (06/11/2026): terceira opção, só entra se existir GEMINI_API_KEY nos segredos
async function gemini(prompt: string, maxTokens: number, json: boolean): Promise<{ texto: string; inTok: number; outTok: number }> {
  const chave = Deno.env.get("GEMINI_API_KEY") || "";
  if (!chave) throw new Error("Sem GEMINI_API_KEY");
  const modelo = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3, ...(json ? { responseMimeType: "application/json" } : {}) } }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  // deno-lint-ignore no-explicit-any
  const texto = (d?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("").trim();
  return { texto, inTok: d?.usageMetadata?.promptTokenCount || 0, outTok: d?.usageMetadata?.candidatesTokenCount || 0 };
}

async function claude(prompt: string, maxTokens: number, meta: Record<string, unknown>): Promise<string> {
  // tradução: OpenAI primeiro (mais barato), depois Anthropic, depois Gemini; cada falha passa pra próxima
  const erros: string[] = [];
  if (OPENAI_KEY) {
    try { return await openai(prompt, maxTokens, meta); } catch (e) { erros.push((e as Error).message); }
  }
  if (ANTHROPIC_KEY) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: MODELO_TRADUCAO, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
      });
      if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const d = await r.json();
      // medidor de custo de IA do Nexus
      supabase.from("ai_usage_log").insert({ fn: "gmail-sync", model: MODELO_TRADUCAO, input_tokens: d.usage?.input_tokens || 0, output_tokens: d.usage?.output_tokens || 0, cache_read_tokens: d.usage?.cache_read_input_tokens || 0, cache_write_tokens: d.usage?.cache_creation_input_tokens || 0, meta }).then(() => {}, () => {});
      // deno-lint-ignore no-explicit-any
      return (d.content || []).map((c: any) => c.text || "").join("").trim();
    } catch (e) { erros.push((e as Error).message); }
  }
  try {
    const g = await gemini(prompt, maxTokens, false);
    supabase.from("ai_usage_log").insert({ fn: "gmail-sync", model: Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash", input_tokens: g.inTok, output_tokens: g.outTok, cache_read_tokens: 0, cache_write_tokens: 0, meta }).then(() => {}, () => {});
    return g.texto;
  } catch (e) { erros.push((e as Error).message); }
  throw new Error(`Tradução falhou: ${erros.join(" | ")}`);
}
const jsonDe = (t: string) => { const m = t.match(/[\[{][\s\S]*[\]}]/); return m ? JSON.parse(m[0]) : null; };

// deno-lint-ignore no-explicit-any
async function traduzirLista(accountId: string, ids: string[]): Promise<any[]> {
  const { data: rows } = await supabase.from("mail_messages").select("gmail_id, subject, snippet, lang").eq("account_id", accountId).in("gmail_id", ids.slice(0, 20));
  // deno-lint-ignore no-explicit-any
  const pendentes = (rows || []).filter((r: any) => !r.lang);
  // deno-lint-ignore no-explicit-any
  const paraIa: any[] = [];
  for (const r of pendentes) {
    if (idiomaLocal(`${r.subject || ""} ${r.snippet || ""}`) === "pt") await supabase.from("mail_messages").update({ lang: "pt" }).eq("account_id", accountId).eq("gmail_id", r.gmail_id);
    else paraIa.push(r);
  }
  if (paraIa.length) {
    const entrada = paraIa.map((r, i) => ({ i, assunto: r.subject || "", trecho: (r.snippet || "").slice(0, 300) }));
    const prompt = `Para cada item, identifique o idioma (código ISO de 2 letras) e, se NÃO for português, traduza assunto e trecho para português do Brasil, natural e fiel. Se já for português, devolva os textos como estão. Responda só com JSON: [{"i":0,"lang":"en","assunto":"...","trecho":"..."}].\n\n${JSON.stringify(entrada)}`;
    try {
      const resp = jsonDe(await claude(prompt, 2000, { acao: "translate-list", qtd: paraIa.length })) || [];
      for (const o of resp) {
        const r = paraIa[o.i]; if (!r) continue;
        const lang = String(o.lang || "").toLowerCase().slice(0, 2) || "xx";
        await supabase.from("mail_messages").update(lang === "pt" ? { lang } : { lang, subject_pt: o.assunto || null, snippet_pt: o.trecho || null }).eq("account_id", accountId).eq("gmail_id", r.gmail_id);
      }
    } catch (e) { console.error("translate-list", e); }
  }
  const { data: fim } = await supabase.from("mail_messages").select("gmail_id, lang, subject_pt, snippet_pt").eq("account_id", accountId).in("gmail_id", ids.slice(0, 20));
  return fim || [];
}

// deno-lint-ignore no-explicit-any
async function traduzirCorpo(accountId: string, gmailId: string): Promise<any> {
  const { data: m } = await supabase.from("mail_messages").select("gmail_id, subject, snippet, body_html, body_text, lang, subject_pt, body_pt, translated_at").eq("account_id", accountId).eq("gmail_id", gmailId).maybeSingle();
  if (!m) return null;
  // translated_at marca que o CORPO já foi avaliado (com body_pt = traduzido; sem = corpo em português).
  // O lang que veio da lista olha assunto+trecho e pode errar (assunto em português, corpo em inglês).
  if (m.body_pt || m.translated_at) return m;
  // a parte "texto" de alguns e-mails (GitHub, newsletters) também traz HTML: limpa sempre
  const texto = semHtml((m.body_text && m.body_text.trim().length > 40 ? m.body_text : m.body_html) || "") || m.snippet || "";
  if (idiomaLocal(texto) === "pt") {
    await supabase.from("mail_messages").update({ translated_at: new Date().toISOString() }).eq("account_id", accountId).eq("gmail_id", gmailId);
    return { ...m, translated_at: new Date().toISOString() };
  }
  const corte = texto.slice(0, 12000);
  const prompt = `Você recebe um e-mail. Primeira linha da resposta: só o código ISO de 2 letras do idioma original. Se for português, pare aí. Se não for, na segunda linha escreva "ASSUNTO: " e o assunto traduzido; depois uma linha em branco e o corpo traduzido para português do Brasil, natural e fiel, mantendo parágrafos, listas, valores, datas, nomes e links (URLs como estão). Não comente nada.\n\nASSUNTO ORIGINAL: ${m.subject || ""}\n\nCORPO:\n${corte}`;
  const resp = await claude(prompt, 4000, { acao: "translate", gmail_id: gmailId, chars: corte.length });
  const linhas = resp.split("\n");
  const lang = (linhas[0] || "").trim().toLowerCase().slice(0, 2) || "xx";
  if (lang === "pt") { await supabase.from("mail_messages").update({ translated_at: new Date().toISOString() }).eq("account_id", accountId).eq("gmail_id", gmailId); return { ...m, translated_at: new Date().toISOString() }; }
  let resto = linhas.slice(1).join("\n").trim();
  let assunto = m.subject_pt;
  const ma = resto.match(/^ASSUNTO:\s*(.*)$/m);
  if (ma) { assunto = ma[1].trim(); resto = resto.replace(ma[0], "").trim(); }
  const upd = { lang, subject_pt: assunto, body_pt: resto + (texto.length > corte.length ? "\n\n[...] (trecho final não traduzido: e-mail muito longo)" : ""), translated_at: new Date().toISOString() };
  await supabase.from("mail_messages").update(upd).eq("account_id", accountId).eq("gmail_id", gmailId);
  return { ...m, ...upd };
}

// ── Watch (push) ───────────────────────────────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function ligarWatch(acc: any): Promise<Record<string, unknown>> {
  const token = await tokenDoUsuario(acc.user_id);
  const r = await gmail(token, "/watch", { method: "POST", body: JSON.stringify({ topicName: GMAIL_PUSH_TOPIC }) });
  const expira = r?.expiration ? new Date(Number(r.expiration)).toISOString() : null;
  await supabase.from("mail_accounts").update({ watch_expiration: expira, last_error: null }).eq("id", acc.id);
  return { email: acc.email, watch_ate: expira };
}

// ── MIME pra envio ─────────────────────────────────────────────────────────────────────────────
function montarMime(p: { from: string; to: string[]; cc?: string[]; bcc?: string[]; subject: string; html?: string; text?: string; inReplyTo?: string; references?: string; attachments?: { filename: string; mimeType: string; data: string }[] }) {
  const b = () => "----=_Nexus_" + crypto.randomUUID().replace(/-/g, "");
  const encHeader = (s: string) => /[^\x20-\x7e]/.test(s) ? `=?UTF-8?B?${btoa(unescape(encodeURIComponent(s)))}?=` : s;
  const linhas: string[] = [
    `From: ${p.from}`, `To: ${p.to.join(", ")}`,
    ...(p.cc?.length ? [`Cc: ${p.cc.join(", ")}`] : []), ...(p.bcc?.length ? [`Bcc: ${p.bcc.join(", ")}`] : []),
    `Subject: ${encHeader(p.subject || "")}`, "MIME-Version: 1.0",
    ...(p.inReplyTo ? [`In-Reply-To: ${p.inReplyTo}`] : []), ...(p.references ? [`References: ${p.references}`] : []),
  ];
  const texto = p.text || (p.html || "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
  const alt = b();
  const corpoAlt = [
    `--${alt}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", btoa(unescape(encodeURIComponent(texto))).replace(/(.{76})/g, "$1\r\n"),
    `--${alt}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", btoa(unescape(encodeURIComponent(p.html || `<pre>${texto}</pre>`))).replace(/(.{76})/g, "$1\r\n"),
    `--${alt}--`,
  ];
  if (!p.attachments?.length) {
    return [...linhas, `Content-Type: multipart/alternative; boundary="${alt}"`, "", ...corpoAlt].join("\r\n");
  }
  const mix = b();
  const partes = [
    ...linhas, `Content-Type: multipart/mixed; boundary="${mix}"`, "",
    `--${mix}`, `Content-Type: multipart/alternative; boundary="${alt}"`, "", ...corpoAlt,
  ];
  for (const a of p.attachments) {
    partes.push(`--${mix}`, `Content-Type: ${a.mimeType || "application/octet-stream"}; name="${a.filename}"`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename="${a.filename}"`, "", String(a.data).replace(/(.{76})/g, "$1\r\n"));
  }
  partes.push(`--${mix}--`);
  return partes.join("\r\n");
}

// ── Identificação de quem chama ───────────────────────────────────────────────────────────────
async function quemChama(req: Request): Promise<{ service: boolean; userId: string | null }> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return { service: false, userId: null };
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    // o cron (job 319) chama com a chave anon do projeto, igual aos outros crons; a chave service_role também vale
    if (payload.role === "service_role" || (payload.role === "anon" && payload.iss === "supabase")) return { service: true, userId: null };
  } catch { /* segue */ }
  const sb = createClient(SUPABASE_URL, ANON_KEY || SERVICE_ROLE);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return { service: false, userId: null };
  return { service: false, userId: data.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const inicio = Date.now();
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch { /* sem corpo */ }
  const quem = await quemChama(req);

  try {
    // Pub/Sub push: {message:{data:base64({"emailAddress","historyId"})}, subscription}
    const pushToken = new URL(req.url).searchParams.get("push");
    if (pushToken !== null && body?.message?.data) {
      // sem segredo configurado, aceita só a assinatura conhecida; o pior caso é uma sincronização extra
      if (GMAIL_PUSH_TOKEN ? pushToken !== GMAIL_PUSH_TOKEN : String(body.subscription || "") !== GMAIL_PUSH_SUBSCRIPTION) return j({ error: "push inválido" }, 401);
      let email = "";
      try { email = String(JSON.parse(b64url(String(body.message.data))).emailAddress || "").toLowerCase(); } catch { /* ignora */ }
      if (!email) return j({ ok: true, ignorado: "sem e-mail" });
      const { data: acc } = await supabase.from("mail_accounts").select("*").ilike("email", email).maybeSingle();
      if (!acc) return j({ ok: true, ignorado: "caixa não conectada" });
      try { const r = await sincronizarCaixa(acc, inicio); return j({ ok: true, push: true, ...r }); }
      catch (e) {
        const msg = (e as Error).message || String(e);
        await supabase.from("mail_accounts").update({ last_error: msg }).eq("id", acc.id);
        // 200 mesmo com erro: senão o Pub/Sub fica reenviando a mesma notificação
        return j({ ok: false, push: true, erro: msg });
      }
    }

    if (body.mode === "watch") {
      if (!quem.service) return j({ error: "só o cron" }, 401);
      const { data: contas } = await supabase.from("mail_accounts").select("*");
      const resultados: Record<string, unknown>[] = [];
      for (const acc of contas || []) {
        try { resultados.push(await ligarWatch(acc)); }
        catch (e) { const msg = (e as Error).message || String(e); await supabase.from("mail_accounts").update({ last_error: msg }).eq("id", acc.id); resultados.push({ email: acc.email, erro: msg }); }
      }
      return j({ ok: true, contas: resultados });
    }

    if (body.mode === "sync") {
      if (!quem.service) return j({ error: "só o cron" }, 401);
      const { data: contas } = await supabase.from("mail_accounts").select("*").order("last_sync_at", { ascending: true, nullsFirst: true });
      const resultados: Record<string, unknown>[] = [];
      for (const acc of contas || []) {
        if (Date.now() - inicio > ORCAMENTO_MS) { resultados.push({ email: acc.email, pulado: "sem tempo" }); continue; }
        try {
          const r = await sincronizarCaixa(acc, inicio);
          // watch do push: liga/renova quando faltar menos de 1 dia (o Gmail expira em 7)
          if (!acc.watch_expiration || new Date(acc.watch_expiration).getTime() < Date.now() + 86400_000) {
            try { Object.assign(r, await ligarWatch(acc)); } catch (e) { r.watch_erro = (e as Error).message || String(e); }
          }
          resultados.push(r);
        }
        catch (e) {
          const msg = (e as Error).message || String(e);
          await supabase.from("mail_accounts").update({ last_error: msg, last_sync_at: new Date().toISOString() }).eq("id", acc.id);
          resultados.push({ email: acc.email, erro: msg });
        }
      }
      return j({ ok: true, contas: resultados });
    }

    if (!quem.userId) return j({ error: "não autenticado" }, 401);
    const userId = quem.userId;
    const action = String(body.action || "status");

    if (action === "connect") {
      const token = await tokenDoUsuario(userId);
      const prof = await gmail(token, "/profile"); // falha com NeedsAuth se não tiver o escopo do Gmail
      const { data: acc } = await supabase.from("mail_accounts").upsert({ user_id: userId, email: prof.emailAddress, updated_at: new Date().toISOString() }, { onConflict: "user_id" }).select("*").single();
      try { await sincronizarCaixa(acc, inicio); } catch (e) { console.error("primeira sync", e); }
      try { await ligarWatch(acc); } catch (e) { console.error("watch", e); }
      return j({ ok: true, account: acc });
    }

    const { data: acc } = await supabase.from("mail_accounts").select("*").eq("user_id", userId).maybeSingle();
    if (action === "status") return j({ ok: true, account: acc || null });
    if (!acc) return j({ error: "caixa não conectada", needsConnect: true }, 400);
    const token = await tokenDoUsuario(userId);

    if (action === "sync-me") {
      const r = await sincronizarCaixa(acc, inicio);
      return j({ ok: true, ...r });
    }

    if (action === "message") {
      const id = String(body.gmail_id || "");
      const m = await gmail(token, `/messages/${id}?format=full`);
      if (!m) return j({ error: "mensagem não existe mais no Gmail" }, 404);
      const row = linhaDaMensagem(acc.id, m, true);
      const { data } = await supabase.from("mail_messages").upsert(row, { onConflict: "account_id,gmail_id" }).select("*").single();
      return j({ ok: true, message: data });
    }

    if (action === "attachment") {
      const att = await gmail(token, `/messages/${body.gmail_id}/attachments/${body.attachment_id}`);
      if (!att) return j({ error: "anexo não encontrado" }, 404);
      return j({ ok: true, data: att.data, size: att.size });
    }

    if (action === "modify") {
      const ids: string[] = body.gmail_ids || [];
      const add: string[] = body.add || []; const remove: string[] = body.remove || [];
      if (!ids.length) return j({ error: "gmail_ids vazio" }, 400);
      await gmail(token, `/messages/batchModify`, { method: "POST", body: JSON.stringify({ ids, addLabelIds: add, removeLabelIds: remove }) });
      const { data: rows } = await supabase.from("mail_messages").select("id, gmail_id, label_ids").eq("account_id", acc.id).in("gmail_id", ids);
      for (const r of rows || []) {
        const labels = new Set<string>(r.label_ids || []);
        for (const a of add) labels.add(a); for (const x of remove) labels.delete(x);
        const arr = [...labels];
        await supabase.from("mail_messages").update({ label_ids: arr, is_unread: arr.includes("UNREAD"), is_starred: arr.includes("STARRED"), updated_at: new Date().toISOString() }).eq("id", r.id);
      }
      return j({ ok: true });
    }

    if (action === "translate-list") {
      const ids: string[] = body.gmail_ids || [];
      if (!ids.length) return j({ ok: true, items: [] });
      return j({ ok: true, items: await traduzirLista(acc.id, ids) });
    }

    if (action === "translate") {
      const m = await traduzirCorpo(acc.id, String(body.gmail_id || ""));
      if (!m) return j({ error: "mensagem não encontrada" }, 404);
      return j({ ok: true, lang: m.lang, subject_pt: m.subject_pt || null, body_pt: m.body_pt || null, translated_at: m.translated_at || null });
    }

    if (action === "delete") {
      // apaga de vez (só faz sentido na Lixeira/Spam); exige o escopo https://mail.google.com/
      const ids: string[] = body.gmail_ids || [];
      if (!ids.length) return j({ error: "gmail_ids vazio" }, 400);
      await gmail(token, `/messages/batchDelete`, { method: "POST", body: JSON.stringify({ ids }) });
      await supabase.from("mail_messages").delete().eq("account_id", acc.id).in("gmail_id", ids);
      return j({ ok: true, apagadas: ids.length });
    }

    if (action === "send") {
      const to: string[] = body.to || []; if (!to.length) return j({ error: "destinatário obrigatório" }, 400);
      const from = acc.email;
      let inReplyTo = body.in_reply_to || undefined, references = body.references || undefined;
      if (body.thread_id && !inReplyTo) {
        const { data: ult } = await supabase.from("mail_messages").select("message_id_header, references_header").eq("account_id", acc.id).eq("thread_id", body.thread_id).order("internal_date", { ascending: false }).limit(1).maybeSingle();
        if (ult?.message_id_header) { inReplyTo = ult.message_id_header; references = [ult.references_header, ult.message_id_header].filter(Boolean).join(" "); }
      }
      const raw = montarMime({ from, to, cc: body.cc || [], bcc: body.bcc || [], subject: body.subject || "", html: body.html, text: body.text, inReplyTo, references, attachments: body.attachments || [] });
      const sent = await gmail(token, `/messages/send`, { method: "POST", body: JSON.stringify({ raw: toB64url(raw), ...(body.thread_id ? { threadId: body.thread_id } : {}) }) });
      if (sent?.id) await buscarEGravar(token, acc.id, [sent.id], true);
      return j({ ok: true, gmail_id: sent?.id, thread_id: sent?.threadId });
    }

    if (action === "search") {
      const q = String(body.q || "").trim(); if (!q) return j({ ok: true, gmail_ids: [] });
      const lista = await gmail(token, `/messages?q=${encodeURIComponent(q)}&maxResults=50`);
      // deno-lint-ignore no-explicit-any
      const ids: string[] = (lista?.messages || []).map((m: any) => m.id);
      const { data: jaTem } = ids.length ? await supabase.from("mail_messages").select("gmail_id").eq("account_id", acc.id).in("gmail_id", ids) : { data: [] };
      // deno-lint-ignore no-explicit-any
      const faltam = ids.filter((id) => !(jaTem || []).some((r: any) => r.gmail_id === id));
      if (faltam.length) await buscarEGravar(token, acc.id, faltam);
      return j({ ok: true, gmail_ids: ids });
    }

    if (action === "disconnect") {
      await supabase.from("mail_accounts").delete().eq("id", acc.id);
      return j({ ok: true });
    }

    return j({ error: `ação desconhecida: ${action}` }, 400);
  } catch (e) {
    if (e instanceof NeedsAuth) return j({ error: e.message, needsAuth: true }, 401);
    console.error("[gmail-sync]", e);
    return j({ error: (e as Error).message || String(e) }, 500);
  }
});
