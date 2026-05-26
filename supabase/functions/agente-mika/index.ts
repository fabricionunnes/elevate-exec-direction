// agente-mika — Social Media Manager via Telegram
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://xrncvhzxjmddqluxoosu.supabase.co";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybmN2aHp4am1kZHFsdXhvb3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjY3NjQsImV4cCI6MjA5NDQ0Mjc2NH0.9j-4JHscbdL4gcf0wbgcSBkxjuxg6TKjocAD2FJVHFk";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const TELEGRAM_TOKEN = Deno.env.get("MIKA_TELEGRAM_TOKEN") ?? "";
const NEXUS_URL = `${SUPABASE_URL}/functions/v1`;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

const SYSTEM_PROMPT = `Você é Mika, a Social Media Manager da UNV Holdings. Você gerencia 3 contas do Instagram com identidades distintas:

1. @universidadevendas — UNV principal. Tom: B2B, autoridade comercial, direto e prático. Cores: navy + vermelho. Foco: gestão comercial, metas, times de vendas.
2. @ofabricionunnes — Conta pessoal do Fabrício. Tom: humano, bastidores, reflexões de CEO. Foco: empreendedorismo, liderança, vida de founder.
3. @mansaoempreendedora — Evento premium. Tom: dark luxury, exclusivo, aspiracional. Cores: preto + dourado. Foco: eventos, experiências high ticket.

Suas capacidades:
- Criar posts com imagem gerada por IA adaptada ao branding de cada conta
- Publicar no Instagram após aprovação
- Listar as contas disponíveis
- Sugerir pautas e calendário de conteúdo

Fluxo de publicação:
1. Usuário pede um post (informe sempre para qual conta)
2. Você usa gerar_post_instagram → recebe preview da imagem no Telegram
3. Usuário aprova ou rejeita
4. Se aprovado: use publicar_post_instagram com o post_id

Regras:
- Sempre confirme para qual conta (@username) está gerando antes de criar
- Se o usuário não especificar, pergunte
- Adapte o copy ao branding de cada conta
- Seja criativa, objetiva e orientada a resultado
- Fale em português brasileiro`;

const TOOLS = [
  {
    name: "listar_contas_instagram",
    description: "Lista as 3 contas do Instagram disponíveis com seus dados e branding",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "gerar_post_instagram",
    description: "Gera um post completo (caption + imagem via IA) para uma conta específica do Instagram. Envia o preview no Telegram para aprovação.",
    input_schema: {
      type: "object",
      properties: {
        account_username: { type: "string", description: "Username do Instagram (universidadevendas, ofabricionunnes ou mansaoempreendedora)" },
        topic: { type: "string", description: "Tema ou assunto do post" },
        post_type: { type: "string", enum: ["feed", "story"], description: "Tipo de post" },
      },
      required: ["account_username", "topic"],
    },
  },
  {
    name: "publicar_post_instagram",
    description: "Publica no Instagram o post aprovado pelo usuário",
    input_schema: {
      type: "object",
      properties: {
        post_id: { type: "string", description: "ID do post pendente (retornado por gerar_post_instagram)" },
      },
      required: ["post_id"],
    },
  },
  {
    name: "rejeitar_post_instagram",
    description: "Rejeita e descarta o post. Use quando o usuário não aprovar.",
    input_schema: {
      type: "object",
      properties: {
        post_id: { type: "string", description: "ID do post pendente" },
      },
      required: ["post_id"],
    },
  },
  {
    name: "status_instagram",
    description: "Verifica o status de conexão do Instagram e dados da conta principal",
    input_schema: { type: "object", properties: {} },
  },
];

async function sendTelegram(chatId: number, text: string, parseMode = "Markdown") {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode, disable_web_page_preview: true }),
  });
}

async function sendTelegramPhoto(chatId: number, photoUrl: string, caption: string) {
  // Caption limitado a 1024 chars (limite do Telegram), sem markdown para evitar erros de parse
  const safeCaption = caption.slice(0, 1024);
  const res = await fetch(`${TELEGRAM_API}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: safeCaption }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[sendTelegramPhoto] erro:", JSON.stringify(err));
    // Fallback: envia URL como texto
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `🖼 Preview da imagem:\n${photoUrl}\n\n${safeCaption}`, disable_web_page_preview: false }),
    });
  }
}

async function executeTool(name: string, input: Record<string, unknown>, chatId: number): Promise<unknown> {
  const authHeaders = { "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" };

  switch (name) {
    case "listar_contas_instagram": {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/unv_instagram_profiles?is_active=eq.true&select=instagram_account_id,instagram_username,account_name,branding`, {
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
      });
      return r.ok ? r.json() : { error: "Erro ao listar contas" };
    }

    case "gerar_post_instagram": {
      const username = input.account_username as string;
      // Busca perfil pelo username
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/unv_instagram_profiles?instagram_username=eq.${username}&select=instagram_account_id,instagram_username,account_name,branding&limit=1`,
        { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const profiles = await profileRes.json();
      if (!profiles?.[0]) return { error: `Conta @${username} não encontrada` };
      const profile = profiles[0];

      const r = await fetch(`${NEXUS_URL}/instagram-post`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({
          action: "generate",
          topic: input.topic,
          post_type: input.post_type ?? "feed",
          chat_id: chatId,
          account_id: profile.instagram_account_id,
          branding: profile.branding,
        }),
      });
      const data = r.ok ? await r.json() : { error: `Erro ${r.status}: ${await r.text()}` };

      // Envia preview no Telegram
      if (data.image_url && data.caption) {
        const previewCaption = `*Preview — @${username}*\n\n${data.caption}\n\n${data.hashtags ?? ""}\n\n_post\\_id: ${data.post_id}_\n\nAprova? Responda *sim* para publicar ou *não* para rejeitar.`;
        await sendTelegramPhoto(chatId, data.image_url, previewCaption);
        return { success: true, post_id: data.post_id, account: username, message: "Preview enviado no Telegram. Aguardando aprovação." };
      }
      return data;
    }

    case "publicar_post_instagram": {
      const r = await fetch(`${NEXUS_URL}/instagram-post`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ action: "publish", post_id: input.post_id }),
      });
      return r.ok ? r.json() : { error: `Erro ${r.status}: ${await r.text()}` };
    }

    case "rejeitar_post_instagram": {
      const r = await fetch(`${NEXUS_URL}/instagram-post`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ action: "reject", post_id: input.post_id }),
      });
      return r.ok ? r.json() : { error: `Erro ${r.status}: ${await r.text()}` };
    }

    case "status_instagram": {
      const r = await fetch(`${NEXUS_URL}/instagram-post`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ action: "status" }),
      });
      return r.ok ? r.json() : { error: "Erro ao verificar status" };
    }

    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}

type Message = { role: "user" | "assistant"; content: unknown };

async function runAgent(chatId: number, history: Message[]): Promise<Message[]> {
  const messages = [...history];
  let iterations = 0;

  while (iterations < 10) {
    iterations++;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      }),
    });

    const data = await res.json();
    if (data.error) { await sendTelegram(chatId, `Erro: ${data.error.message}`); return messages; }

    messages.push({ role: "assistant", content: data.content });

    if (data.stop_reason === "end_turn") {
      const textBlock = data.content.find((b: { type: string }) => b.type === "text");
      if (textBlock?.text) await sendTelegram(chatId, textBlock.text);
      return messages;
    }

    if (data.stop_reason === "tool_use") {
      const toolResults = [];
      for (const block of data.content) {
        if (block.type !== "tool_use") continue;
        const result = await executeTool(block.name, block.input ?? {}, chatId);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }
  return messages;
}

async function loadHistory(chatId: number): Promise<Message[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/unv_mika_chat_history?chat_id=eq.${chatId}&select=messages`,
    { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  const data = await res.json();
  return data?.[0]?.messages ?? [];
}

async function saveHistory(chatId: number, messages: Message[]): Promise<void> {
  const trimmed = messages.slice(-30);
  await fetch(`${SUPABASE_URL}/rest/v1/unv_mika_chat_history?on_conflict=chat_id`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates",
    },
    body: JSON.stringify({ chat_id: chatId, messages: trimmed, updated_at: new Date().toISOString() }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, agent: "Mika", status: "online" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const message = body?.message;
    if (!message) return new Response("ok");

    const chatId: number = message.chat?.id;
    const chatType: string = message.chat?.type ?? "private"; // private | group | supergroup
    let text: string = (message.text ?? "").trim();
    if (!chatId || !text) return new Response("ok");

    // Em grupos: só responde se for mencionada por nome ou @username
    const BOT_USERNAME = "MikaUNV_bot";
    const BOT_NAMES = ["mika", "@mikaUNV_bot", `@${BOT_USERNAME.toLowerCase()}`];
    const isGroup = chatType === "group" || chatType === "supergroup";

    if (isGroup) {
      const textLower = text.toLowerCase();
      const mentioned = BOT_NAMES.some(n => textLower.includes(n));
      // Também aceita reply a mensagem da Mika
      const isReplyToBot = message.reply_to_message?.from?.username?.toLowerCase() === BOT_USERNAME.toLowerCase();
      if (!mentioned && !isReplyToBot) return new Response("ok"); // não é pra Mika
      // Remove @mention do texto antes de processar
      text = text.replace(new RegExp(`@${BOT_USERNAME}`, "gi"), "").trim();
    }

    // /start
    if (text === "/start") {
      await saveHistory(chatId, []);
      await sendTelegram(chatId, `Oi! Sou a *Mika*, Social Media Manager da UNV. 🎨\n\nGerencio:\n• @universidadevendas\n• @ofabricionunnes\n• @mansaoempreendedora\n\nMe diz o que quer criar!`);
      return new Response("ok");
    }

    // Em grupos, prefixa a mensagem com o nome do remetente para contexto
    const senderName = message.from?.first_name ?? "";
    const contextText = isGroup && senderName ? `[${senderName}]: ${text}` : text;

    // Carrega histórico persistido no banco
    const history = await loadHistory(chatId);
    history.push({ role: "user", content: contextText });

    const updatedHistory = await runAgent(chatId, history);
    await saveHistory(chatId, updatedHistory);

    return new Response("ok");
  } catch (err) {
    console.error("[agente-mika]", err);
    return new Response("ok");
  }
});
