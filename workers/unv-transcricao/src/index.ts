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
      let audio: ArrayBuffer; let lang = "pt";
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const body = await req.json() as { url?: string; language?: string };
        if (!body.url) return json({ error: "sem url" }, 400);
        if (body.language) lang = body.language;
        const r = await fetch(body.url, { signal: AbortSignal.timeout(30000) });
        if (!r.ok) return json({ error: `download ${r.status}` }, 502);
        audio = await r.arrayBuffer();
      } else {
        audio = await req.arrayBuffer();
      }
      if (audio.byteLength < 200) return json({ error: `arquivo vazio (${audio.byteLength} bytes)` }, 400);
      if (audio.byteLength > 25 * 1024 * 1024) return json({ error: "arquivo > 25MB" }, 413);
      const out = await env.AI.run("@cf/openai/whisper-large-v3-turbo", { audio: b64(audio), language: lang, task: "transcribe" } as any) as { text?: string };
      const text = String(out?.text || "").trim();
      return json({ text, bytes: audio.byteLength, modelo: "whisper-large-v3-turbo" });
    } catch (e) {
      return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
    }
  },
};
