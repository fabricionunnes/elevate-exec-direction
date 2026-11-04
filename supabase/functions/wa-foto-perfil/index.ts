// wa-foto-perfil: preenche e renova a foto de perfil do WhatsApp dos contatos do Atendimento.
// Fabrício, 04/11/2026: "aparecer a foto do cliente, a que está no whatsapp ou instagram".
// O webhook já busca a foto ao chegar mensagem; esta function cobre o estoque (contatos ativos
// nos últimos 30 dias) em lotes, chamada por cron. O link do WhatsApp expira em ~10 dias, então
// quem está ativo é revalidado a cada 7. Lê os pendentes pela RPC wa_foto_perfil_pendentes.
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type Pendente = { contact_id: string; phone: string; instance_name: string; api_url: string; api_key: string };

async function buscarFoto(p: Pendente): Promise<{ url: string | null; erro?: string }> {
  const base = String(p.api_url).replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`${base}/chat/fetchProfilePictureUrl/${encodeURIComponent(p.instance_name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: p.api_key },
      body: JSON.stringify({ number: p.phone }),
      signal: controller.signal,
    });
    const txt = await r.text();
    if (!r.ok) return { url: null, erro: `HTTP ${r.status}` };
    try { return { url: JSON.parse(txt)?.profilePictureUrl || null }; } catch { return { url: null, erro: "resposta inválida" }; }
  } catch (e) {
    return { url: null, erro: (e as Error)?.message || "falha" };
  } finally { clearTimeout(timer); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!req.headers.get("authorization")) return j({ ok: false, error: "não autenticado" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: any = {};
  try { body = await req.json(); } catch { /* sem corpo */ }
  const limite = Math.min(Math.max(Number(body.limite) || 60, 1), 200);

  const { data: pendentes, error } = await supabase.rpc("wa_foto_perfil_pendentes", { p_limite: limite });
  if (error) return j({ ok: false, error: error.message });
  const lista: Pendente[] = pendentes || [];

  let comFoto = 0, semFoto = 0, falhas = 0;
  // 3 por vez: a Evolution responde em ~0,5 s cada; 60 contatos ficam em ~10 s
  const fila = [...lista];
  const worker = async () => {
    while (fila.length) {
      const p = fila.shift()!;
      const r = await buscarFoto(p);
      if (r.erro && !/HTTP 4\d\d/.test(r.erro)) { falhas++; continue; } // falha de rede: tenta no próximo lote
      if (r.url) comFoto++; else semFoto++;
      await supabase.from("crm_whatsapp_contacts")
        .update({ profile_picture_url: r.url, profile_picture_checked_at: new Date().toISOString() })
        .eq("id", p.contact_id);
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  const resumo = { ok: true, processados: lista.length, com_foto: comFoto, sem_foto: semFoto, falhas };
  console.log("[wa-foto-perfil]", JSON.stringify(resumo));
  return j(resumo);
});
