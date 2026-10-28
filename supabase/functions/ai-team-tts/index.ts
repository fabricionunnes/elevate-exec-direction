// ai-team-tts: a voz do Max. Recebe texto e devolve áudio (audio/mpeg).
// Provedor por secret, nesta ordem: ELEVENLABS_API_KEY (voz em AI_TEAM_TTS_VOICE,
// modelo eleven_flash_v2_5, pt-BR natural) → OPENAI_API_KEY (tts-1, voz AI_TEAM_TTS_VOICE
// ou "onyx") → 501 (a tela cai pro sintetizador do navegador).
// Exige usuário logado (qualquer autenticado) ou service role: áudio custa dinheiro.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function jwtRole(token: string): string {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return String(JSON.parse(atob(payload))?.role || "");
  } catch { return ""; }
}

/** Limpa o texto pra fala: tira markdown residual, URLs e espaços duplos. */
function paraFala(text: string): string {
  return text
    .replace(/[*_#`>]+/g, "")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2500);
}

/** Diagnóstico (?diag=1): testa cada provedor com 3 palavras e devolve só o status, sem chave. */
async function diagnostico(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const eleven = Deno.env.get("ELEVENLABS_API_KEY");
  const openai = Deno.env.get("OPENAI_API_KEY");
  out.elevenlabs_key = eleven ? `presente (${eleven.length} chars, começa com ${eleven.slice(0, 3)})` : "ausente";
  out.openai_key = openai ? `presente (${openai.length} chars, começa com ${openai.slice(0, 3)})` : "ausente";
  out.voice = Deno.env.get("AI_TEAM_TTS_VOICE") || "(padrão Adam)";
  if (eleven) {
    try {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${Deno.env.get("AI_TEAM_TTS_VOICE") || "pNInz6obpgDQGcFmaJgB"}?output_format=mp3_22050_32`, {
        method: "POST", headers: { "xi-api-key": eleven, "Content-Type": "application/json" },
        body: JSON.stringify({ text: "teste de voz", model_id: "eleven_flash_v2_5" }),
      });
      out.elevenlabs = r.ok ? `ok (${r.headers.get("Content-Type")})` : `${r.status}: ${(await r.text()).slice(0, 200)}`;
    } catch (e) { out.elevenlabs = `erro: ${(e as Error).message}`; }
  }
  if (openai) {
    for (const model of ["gpt-4o-mini-tts", "tts-1"]) {
      try {
        const r = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST", headers: { Authorization: `Bearer ${openai}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, voice: "ash", input: "teste de voz", response_format: "mp3" }),
        });
        // a organização dona da chave vem no header: ajuda a achar em qual conta colocar crédito
        out.openai_org = r.headers.get("openai-organization") || out.openai_org || "(não informado)";
        out[`openai_${model}`] = r.ok ? `ok (${r.headers.get("Content-Type")})` : `${r.status}: ${(await r.text()).slice(0, 200)}`;
      } catch (e) { out[`openai_${model}`] = `erro: ${(e as Error).message}`; }
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const role = jwtRole(token);
    if (new URL(req.url).searchParams.get("diag") === "1" && ["anon", "authenticated", "service_role"].includes(role)) {
      return json(await diagnostico());
    }
    if (!["authenticated", "service_role"].includes(role)) return json({ error: "exige usuário logado" }, 401);

    const body = await req.json().catch(() => ({}));
    const text = paraFala(String(body.text || ""));
    if (!text) return json({ error: "text obrigatório" }, 400);

    const eleven = Deno.env.get("ELEVENLABS_API_KEY");
    const openai = Deno.env.get("OPENAI_API_KEY");
    const voice = Deno.env.get("AI_TEAM_TTS_VOICE");
    // cada tentativa que falhar entra aqui e volta pro navegador: a tela mostra o motivo
    const falhas: string[] = [];

    if (eleven) {
      const voiceId = voice || "pNInz6obpgDQGcFmaJgB"; // Adam (premade), multilingual
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
        method: "POST",
        headers: { "xi-api-key": eleven, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: "eleven_flash_v2_5", voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true } }),
      });
      if (r.ok) return new Response(r.body, { headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "X-Tts-Provider": "elevenlabs" } });
      const err = (await r.text()).slice(0, 300);
      console.error("elevenlabs", r.status, err);
      falhas.push(`elevenlabs ${r.status}: ${err.replace(/\s+/g, " ").slice(0, 160)}`);
      // cai pro OpenAI se tiver
    } else {
      falhas.push("elevenlabs: ELEVENLABS_API_KEY não configurada");
    }

    if (openai) {
      // gpt-4o-mini-tts aceita instrução de tom e soa bem menos robótico que o tts-1;
      // se o modelo não estiver disponível na conta, cai pro tts-1.
      const voz = (eleven ? "ash" : voice) || "ash";
      const call = (model: string, extra: Record<string, unknown>) => fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${openai}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, voice: voz, input: text, response_format: "mp3", ...extra }),
      });
      let r = await call("gpt-4o-mini-tts", {
        instructions: "Fale em português do Brasil, sotaque neutro brasileiro. Voz masculina, grave, calma e segura, como um sócio experiente conversando no escritório: ritmo natural de fala, pausas curtas entre frases, sem entonação de locutor, sem soar como leitura. Energia média, nunca animado demais.",
      });
      if (!r.ok) {
        const e1 = (await r.text()).slice(0, 200);
        console.error("gpt-4o-mini-tts", r.status, e1);
        falhas.push(`openai gpt-4o-mini-tts ${r.status}: ${e1.replace(/\s+/g, " ").slice(0, 120)}`);
        r = await call("tts-1", { speed: 1.03 });
      }
      if (r.ok) return new Response(r.body, { headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "X-Tts-Provider": "openai" } });
      const err = (await r.text()).slice(0, 200);
      console.error("openai tts", r.status, err);
      falhas.push(`openai tts-1 ${r.status}: ${err.replace(/\s+/g, " ").slice(0, 120)}`);
      return json({ error: "nenhum provedor de voz respondeu", falhas }, 502);
    }

    falhas.push("openai: OPENAI_API_KEY não configurada");
    return json({ error: "nenhum provedor de voz configurado", falhas }, 501);
  } catch (e) {
    console.error("ai-team-tts", e);
    return json({ error: (e as Error).message }, 500);
  }
});
