// instagram-post — gera conteúdo, cria preview e posta no Instagram
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://xrncvhzxjmddqluxoosu.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("STORAGE_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybmN2aHp4am1kZHFsdXhvb3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjY3NjQsImV4cCI6MjA5NDQ0Mjc2NH0.9j-4JHscbdL4gcf0wbgcSBkxjuxg6TKjocAD2FJVHFk";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const GRAPH_API = "https://graph.facebook.com/v21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Busca token OAuth (sempre da conta UNV conectada)
async function getInstagramConnection(igAccountId?: string): Promise<{ token: string; igAccountId: string } | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/unv_meta_ads_accounts?is_connected=eq.true&select=access_token,instagram_business_account_id&order=updated_at.desc&limit=1`,
    { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  const data = await res.json();
  if (!data?.[0]?.access_token) return null;
  // Se account_id específico fornecido, usa ele; senão usa o da conta UNV
  const resolvedId = igAccountId ?? data[0].instagram_business_account_id;
  if (!resolvedId) return null;
  return { token: data[0].access_token, igAccountId: resolvedId };
}

// Monta layout editorial: fundo + overlay escuro + barra vermelha + título + logo
async function buildBrandedLayout(
  bgBytes: Uint8Array,
  title: string,
  logoUrl?: string,
  accentColor = { r: 204, g: 27, b: 27 } // vermelho UNV
): Promise<Uint8Array> {
  try {
    const { Image } = await import("https://deno.land/x/imagescript@1.2.15/mod.ts");

    const img = await Image.decode(bgBytes);
    const W = img.width;   // 1024
    const H = img.height;  // 1024

    // 1. Overlay escuro no terço inferior (flat, não pixel-por-pixel)
    const overlayH = Math.floor(H * 0.42);
    const overlayY = H - overlayH;
    const overlay = new Image(W, overlayH);
    overlay.fill(Image.rgbaToColor(8, 12, 30, 210));
    img.composite(overlay, 0, overlayY);

    // 2. Barra colorida separando o fundo do overlay
    const barH = 7;
    const bar = new Image(W, barH);
    bar.fill(Image.rgbaToColor(accentColor.r, accentColor.g, accentColor.b, 255));
    img.composite(bar, 0, overlayY - barH);

    // 3. Título em branco — tenta carregar fonte Montserrat Bold via CDN
    const titleUpper = title.toUpperCase().slice(0, 40);
    try {
      const fontRes = await fetch(
        "https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-700-normal.ttf",
        { signal: AbortSignal.timeout(8000) }
      );
      if (fontRes.ok) {
        const fontBytes = new Uint8Array(await fontRes.arrayBuffer());
        // Escala de fonte baseada no comprimento do título
        const scale = titleUpper.length <= 12 ? 88 : titleUpper.length <= 20 ? 72 : 56;
        const textImg = await Image.renderText(fontBytes, scale, titleUpper, Image.rgbaToColor(255, 255, 255, 255));
        // Centraliza horizontalmente, 64px abaixo da barra vermelha
        const tx = Math.max(0, Math.floor((W - textImg.width) / 2));
        const ty = overlayY + 64;
        if (tx + textImg.width <= W && ty + textImg.height <= H) {
          img.composite(textImg, tx, ty);
        }
      }
    } catch { /* se fonte falhar, continua sem texto */ }

    // 4. Logo no canto inferior esquerdo
    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(6000) });
        if (logoRes.ok) {
          const logoBytes = new Uint8Array(await logoRes.arrayBuffer());
          const logo = await Image.decode(logoBytes);
          const logoW = Math.floor(W * 0.18);
          const logoH = Math.floor(logo.height * (logoW / logo.width));
          logo.resize(logoW, logoH);
          const pad = Math.floor(W * 0.05);
          img.composite(logo, pad, H - logoH - pad);
        }
      } catch { /* logo opcional */ }
    }

    return await img.encode(1);
  } catch {
    return bgBytes;
  }
}

// Gera imagem via OpenAI gpt-image-1 — pede SOMENTE background artístico, sem texto
async function generateImage(bgPrompt: string, title: string, logoUrl?: string): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

  // Prompt focado em background visual de alta qualidade, sem texto ou logos
  const fullPrompt = `${bgPrompt}. NO TEXT, NO LETTERS, NO LOGOS anywhere in the image. Abstract/artistic background only. Dark moody cinematic lighting. Professional photography or abstract art style. 1:1 square format, all elements completely within frame.`;

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-1", prompt: fullPrompt.slice(0, 4000), n: 1, size: "1024x1024", quality: "medium" }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`OpenAI erro ${data.error.code ?? ""}: ${data.error.message}`);

  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI não retornou imagem");

  let binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  // Monta layout editorial: overlay + barra + título + logo
  binary = await buildBrandedLayout(binary, title, logoUrl);

  const filename = `posts/${Date.now()}.png`;
  const storageRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/mika-posts/${filename}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "image/png",
        "x-upsert": "true",
      },
      body: binary,
    }
  );
  if (!storageRes.ok) {
    const errText = await storageRes.text();
    throw new Error(`Storage upload falhou: ${storageRes.status} ${errText}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/mika-posts/${filename}`;
}

// Posta no Instagram via Graph API (feed post com imagem)
async function postToInstagram(igAccountId: string, token: string, imageUrl: string, caption: string): Promise<string> {
  // Step 1: Cria container de mídia
  const containerRes = await fetch(`${GRAPH_API}/${igAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
  });
  const containerData = await containerRes.json();
  if (containerData.error) throw new Error(`Container: ${containerData.error.message}`);
  const containerId = containerData.id;
  if (!containerId) throw new Error("Container ID não retornado");

  // Step 2: Aguarda processamento (até 30s)
  let statusOk = false;
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await fetch(`${GRAPH_API}/${containerId}?fields=status_code&access_token=${token}`);
    const statusData = await statusRes.json();
    if (statusData.status_code === "FINISHED") { statusOk = true; break; }
    if (statusData.status_code === "ERROR") throw new Error("Processamento do container falhou");
  }
  if (!statusOk) throw new Error("Timeout no processamento do container");

  // Step 3: Publica
  const publishRes = await fetch(`${GRAPH_API}/${igAccountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: token }),
  });
  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(`Publicação: ${publishData.error.message}`);
  return publishData.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, topic, post_type, chat_id, post_id, account_id, branding } = body;

    // ── GERAR post (caption + imagem) ──
    if (action === "generate") {
      if (!topic) return new Response(JSON.stringify({ error: "topic obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!chat_id) return new Response(JSON.stringify({ error: "chat_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Monta system prompt com branding específico da conta
      const accountName = branding?.account_name ?? "UNV Universidade de Vendas";
      const colors = branding?.colors ?? "navy #0D2B5E e vermelho #CC1B1B";
      const style = branding?.style ?? "B2B premium, moderno, minimalista";
      const tone = branding?.tone ?? "direto, prático, autoridade comercial";
      const focus = branding?.focus ?? "gestão comercial, times de vendas, metas";
      const hashtags_base = branding?.hashtags_base ?? "#unv #vendas #gestaocomercial";
      const logoText = branding?.logo_text ?? "UNV";
      const logoUrl: string | undefined = branding?.logo_url;

      const brandingInfo = `Conta: ${accountName}\nEstilo: ${style}\nCores: ${colors}\nTom: ${tone}\nFoco: ${focus}\nHashtags base: ${hashtags_base}`;

      // Gera caption com Claude
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": Deno.env.get("CLAUDE_API_KEY") ?? Deno.env.get("ANTHROPIC_API_KEY") ?? "",
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 800,
          system: `Você é Mika, Social Media Manager da UNV Holdings.
${brandingInfo}
Escreva em português brasileiro. Adapte o tom ao branding da conta.
Retorne SOMENTE um JSON com: {"caption": "...", "hashtags": "...", "post_title": "...", "image_background": "..."}

Regras:
- caption: texto completo do post em português, tom ${tone}
- hashtags: relevantes para ${focus}
- post_title: título CURTO em português (máx 4 palavras) que vai aparecer sobreposto na imagem. Exemplo: "Alta Performance", "Meta Batida", "Time Vencedor"
- image_background: descreva EM INGLÊS SOMENTE o fundo visual/artístico da imagem. NÃO mencione texto, logos ou design elements. Foque na atmosfera visual: cores ${colors}, tema ${focus}, estilo fotográfico ou abstrato premium. Exemplo: "dark navy blue abstract geometric background with subtle diagonal lines and dramatic lighting"`,
          messages: [{ role: "user", content: `Crie um post para Instagram sobre: ${topic}. Tipo: ${post_type ?? "feed"}.` }],
        }),
      });
      const claudeData = await claudeRes.json();
      const rawText = claudeData.content?.[0]?.text ?? "{}";
      let parsed: { caption?: string; hashtags?: string; post_title?: string; image_background?: string } = {};
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch { parsed = {}; }

      const caption = parsed.caption ?? `Post sobre ${topic}`;
      const hashtags = parsed.hashtags ?? hashtags_base;
      const postTitle = parsed.post_title ?? topic.split(" ").slice(0, 3).join(" ");
      const bgPrompt = parsed.image_background ?? `dark ${colors} abstract professional background, cinematic lighting`;

      // Gera imagem: fundo artístico + overlay com título e logo
      const imageUrl = await generateImage(bgPrompt, postTitle, logoUrl);

      // Salva post pendente
      const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/unv_instagram_posts`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation",
        },
        body: JSON.stringify({ chat_id, caption, image_url: imageUrl, image_prompt: imagePrompt, hashtags, post_type: post_type ?? "feed", status: "pending", account_id: account_id ?? null }),
      });
      const saved = await saveRes.json();
      const pendingId = saved?.[0]?.id ?? null;

      return new Response(JSON.stringify({ success: true, post_id: pendingId, caption, hashtags, image_url: imageUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── PUBLICAR post aprovado ──
    if (action === "publish") {
      if (!post_id) return new Response(JSON.stringify({ error: "post_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Busca post pendente
      const postRes = await fetch(`${SUPABASE_URL}/rest/v1/unv_instagram_posts?id=eq.${post_id}&select=*`, {
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
      });
      const posts = await postRes.json();
      const post = posts?.[0];
      if (!post) return new Response(JSON.stringify({ error: "Post não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const conn = await getInstagramConnection(post.account_id ?? undefined);
      if (!conn) return new Response(JSON.stringify({ error: "Instagram não conectado. Reconecte via OAuth com permissões de publicação." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const fullCaption = `${post.caption}\n\n${post.hashtags ?? ""}`.trim();
      const mediaId = await postToInstagram(conn.igAccountId, conn.token, post.image_url, fullCaption);

      // Atualiza status no banco
      await fetch(`${SUPABASE_URL}/rest/v1/unv_instagram_posts?id=eq.${post_id}`, {
        method: "PATCH",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "posted", instagram_media_id: mediaId, posted_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      });

      return new Response(JSON.stringify({ success: true, instagram_media_id: mediaId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── REJEITAR post ──
    if (action === "reject") {
      if (!post_id) return new Response(JSON.stringify({ error: "post_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      await fetch(`${SUPABASE_URL}/rest/v1/unv_instagram_posts?id=eq.${post_id}`, {
        method: "PATCH",
        headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected", updated_at: new Date().toISOString() }),
      });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── STATUS do Instagram (verifica conexão) ──
    if (action === "status") {
      const conn = await getInstagramConnection();
      if (!conn) return new Response(JSON.stringify({ connected: false, message: "Instagram não conectado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const igRes = await fetch(`${GRAPH_API}/${conn.igAccountId}?fields=id,username,followers_count,media_count&access_token=${conn.token}`);
      const igData = await igRes.json();

      return new Response(JSON.stringify({ connected: true, ...igData }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "action inválida. Use: generate, publish, reject, status" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[instagram-post] Erro:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
