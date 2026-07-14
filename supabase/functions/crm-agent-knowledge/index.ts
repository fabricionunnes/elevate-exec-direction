import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Extrai texto legível de HTML (remove script/style/tags, normaliza espaços)
function htmlToText(html: string): string {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<\/(p|div|br|li|h[1-6]|tr|section|article)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
  s = s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

const MAX_CHARS = 60000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { action, knowledge_id, url } = await req.json();
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (action === "ingest_link") {
      if (!knowledge_id || !url) throw new Error("knowledge_id e url obrigatórios");
      try {
        const resp = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; UNV-Nexus-Agent/1.0)" },
          redirect: "follow",
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const ct = resp.headers.get("content-type") || "";
        const raw = await resp.text();
        let text = ct.includes("html") ? htmlToText(raw) : raw;
        if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);
        await supabase.from("crm_ai_agent_knowledge").update({
          content: text,
          char_count: text.length,
          status: text.length > 20 ? "ready" : "error",
          error: text.length > 20 ? null : "Sem conteúdo textual extraível",
        }).eq("id", knowledge_id);
        return new Response(JSON.stringify({ ok: true, chars: text.length }), { headers: { ...cors, "Content-Type": "application/json" } });
      } catch (e) {
        await supabase.from("crm_ai_agent_knowledge").update({
          status: "error", error: String((e as Error).message || e),
        }).eq("id", knowledge_id);
        return new Response(JSON.stringify({ ok: false, error: String((e as Error).message || e) }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ ok: false, error: "ação desconhecida" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message || e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
