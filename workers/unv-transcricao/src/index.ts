// POST { url } (ou corpo binário do áudio) + header x-secret → { text }
// Modelo: @cf/openai/whisper-large-v3-turbo (português). Tamanho máx. ~25 MB.
export interface Env { AI: Ai; TRANSCRIBE_SECRET: string }

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

function b64(bytes: ArrayBuffer): string {
  const u = new Uint8Array(bytes); let s = ""; const chunk = 0x8000;
  for (let i = 0; i < u.length; i += chunk) s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + chunk)));
  return btoa(s);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "GET") return json({ ok: true, servico: "unv-transcricao" });
    if (req.method !== "POST") return json({ error: "método" }, 405);
    if (!env.TRANSCRIBE_SECRET || req.headers.get("x-secret") !== env.TRANSCRIBE_SECRET) return json({ error: "não autorizado" }, 401);
    try {
      let audio: ArrayBuffer; let lang = "pt"; let tipo = "";
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const body = await req.json() as { url?: string; language?: string };
        if (!body.url) return json({ error: "sem url" }, 400);
        if (body.language) lang = body.language;
        // o CDN do Instagram (lookaside.fbsbx.com) devolve uma página HTML pra quem não se
        // identifica como navegador; com User-Agent de navegador vem o MP4 do áudio (23/10/2026)
        const r = await fetch(body.url, { signal: AbortSignal.timeout(30000), headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36" } });
        if (!r.ok) return json({ error: `download ${r.status}` }, 502);
        tipo = (r.headers.get("content-type") || "").split(";")[0];
        if (tipo.startsWith("text/")) return json({ error: `download devolveu ${tipo} em vez de áudio` }, 502);
        audio = await r.arrayBuffer();
      } else {
        tipo = ct.split(";")[0];
        audio = await req.arrayBuffer();
      }
      if (audio.byteLength < 200) return json({ error: `arquivo vazio (${audio.byteLength} bytes)` }, 400);
      if (audio.byteLength > 25 * 1024 * 1024) return json({ error: "arquivo > 25MB" }, 413);
      try {
        const out = await env.AI.run("@cf/openai/whisper-large-v3-turbo", { audio: b64(audio), language: lang, task: "transcribe" } as any) as { text?: string };
        const text = String(out?.text || "").trim();
        return json({ text, bytes: audio.byteLength, modelo: "whisper-large-v3-turbo" });
      } catch (e1) {
        // 23/10/2026: áudio do Instagram chega como MP4 (AAC) e o Whisper da Cloudflare recusa
        // ("Failed to decode audio file", o @cf/openai/whisper também). O Deepgram nova-3 do
        // Workers AI decodifica MP4/AAC/M4A.
        const out = await env.AI.run("@cf/deepgram/nova-3" as any, {
          audio: { body: new Blob([audio]).stream(), contentType: tipo || "audio/mp4" },
          language: lang, punctuate: true, smart_format: true,
        } as any) as any;
        const text = String(out?.results?.channels?.[0]?.alternatives?.[0]?.transcript || out?.text || "").trim();
        return json({ text, bytes: audio.byteLength, modelo: "deepgram-nova-3", erro_turbo: String((e1 as Error).message || e1).slice(0, 120) });
      }
    } catch (e) {
      return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
    }
  },
};
