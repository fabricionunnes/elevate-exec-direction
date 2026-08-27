// transcribe-media: transcreve áudio/vídeo enviado pelo time (bucket "transcricoes")
// ou um link direto. Usa AssemblyAI com separação de falantes; o resultado volta
// por webhook (sem polling preso na função) e um cron reconcilia o que ficar pra trás.
//
// Ações:
//   { action: "start",   transcription_id }  -> manda pra fila da AssemblyAI
//   { action: "webhook", ... }               -> chamado pela AssemblyAI ao concluir
//   { action: "reconcile" }                  -> varre pendentes (cron)
//   { action: "summarize", transcription_id} -> gera resumo/tópicos/ações com IA
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const AAI = "https://api.assemblyai.com/v2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/transcribe-media`;

function sb() {
  return createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** manda o arquivo pra AssemblyAI e guarda o id do job */
async function start(supabase: any, id: string) {
  const KEY = Deno.env.get("ASSEMBLYAI_API_KEY");
  if (!KEY) return json({ error: "ASSEMBLYAI_API_KEY não configurada" }, 500);

  const { data: t } = await supabase.from("media_transcriptions").select("*").eq("id", id).maybeSingle();
  if (!t) return json({ error: "transcrição não encontrada" }, 404);

  // link direto ou URL assinada do arquivo no bucket (4h dá folga pro download)
  let audioUrl = t.source_url as string | null;
  if (!audioUrl && t.file_path) {
    const { data: signed, error: sErr } = await supabase.storage
      .from("transcricoes").createSignedUrl(t.file_path, 60 * 60 * 4);
    if (sErr || !signed?.signedUrl) {
      await supabase.from("media_transcriptions")
        .update({ status: "error", error_message: "Não consegui liberar o arquivo: " + (sErr?.message || "url vazia") })
        .eq("id", id);
      return json({ error: "falha ao assinar url" }, 500);
    }
    audioUrl = signed.signedUrl;
  }
  if (!audioUrl) {
    await supabase.from("media_transcriptions").update({ status: "error", error_message: "Sem arquivo nem link" }).eq("id", id);
    return json({ error: "sem arquivo" }, 400);
  }

  const resp = await fetch(`${AAI}/transcript`, {
    method: "POST",
    headers: { authorization: KEY, "content-type": "application/json" },
    body: JSON.stringify({
      audio_url: audioUrl,
      language_code: t.language || "pt",
      speaker_labels: true,          // separa quem fala
      punctuate: true,
      format_text: true,
      webhook_url: `${FN_URL}?action=webhook&id=${id}`,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    await supabase.from("media_transcriptions")
      .update({ status: "error", error_message: `AssemblyAI ${resp.status}: ${JSON.stringify(data).slice(0, 300)}` })
      .eq("id", id);
    return json({ error: "AssemblyAI recusou", detail: data }, 502);
  }

  await supabase.from("media_transcriptions")
    .update({ status: "processing", provider_job_id: data.id, error_message: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  return json({ ok: true, job_id: data.id });
}

/** busca o resultado pronto e grava texto + falantes */
async function coletar(supabase: any, id: string, jobId: string) {
  const KEY = Deno.env.get("ASSEMBLYAI_API_KEY")!;
  const r = await fetch(`${AAI}/transcript/${jobId}`, { headers: { authorization: KEY } });
  const d = await r.json();

  if (d.status === "error") {
    await supabase.from("media_transcriptions")
      .update({ status: "error", error_message: String(d.error || "erro na transcrição") }).eq("id", id);
    return { ok: false, status: "error" };
  }
  if (d.status !== "completed") return { ok: true, status: d.status };

  const utterances = (d.utterances || []).map((u: any) => ({
    speaker: u.speaker, start: u.start, end: u.end, text: u.text,
  }));
  await supabase.from("media_transcriptions").update({
    status: "done",
    text: d.text || "",
    utterances,
    duration_seconds: d.audio_duration || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  // resumo é bônus: se falhar, a transcrição continua salva
  try { await resumir(supabase, id); } catch (e) { console.error("[transcribe-media] resumo:", e); }
  return { ok: true, status: "done" };
}

/** resumo, tópicos e próximos passos com IA */
async function resumir(supabase: any, id: string) {
  const KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!KEY) return;
  const { data: t } = await supabase.from("media_transcriptions").select("title, text, utterances").eq("id", id).maybeSingle();
  if (!t?.text) return;

  const falas = Array.isArray(t.utterances) && t.utterances.length
    ? t.utterances.map((u: any) => `Falante ${u.speaker}: ${u.text}`).join("\n").slice(0, 40000)
    : String(t.text).slice(0, 40000);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Você é diretor comercial da UNV. Leia a transcrição e devolve SÓ JSON válido:
{"summary":"resumo em 3-5 frases, direto, sem enrolação","topics":["assunto 1","assunto 2"],"action_items":[{"title":"ação combinada","owner":"quem ficou responsável ou vazio"}]}
Regras: use apenas o que foi dito, não invente compromisso. Se não houver ação clara, devolva lista vazia.

TRANSCRIÇÃO:
${falas}`,
      }],
    }),
  });
  if (!r.ok) { console.error("[transcribe-media] IA:", r.status, (await r.text()).slice(0, 200)); return; }
  const d = await r.json();
  const txt = (d.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return;
  const parsed = JSON.parse(m[0]);
  await supabase.from("media_transcriptions").update({
    summary: parsed.summary || null,
    topics: parsed.topics || [],
    action_items: parsed.action_items || [],
    updated_at: new Date().toISOString(),
  }).eq("id", id);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = url.searchParams.get("action") || body.action;
    const supabase = sb();

    if (action === "start") return await start(supabase, body.transcription_id);

    if (action === "webhook") {
      // AssemblyAI avisa que terminou; o id da nossa linha vem na query
      const id = url.searchParams.get("id") || body.id;
      const jobId = body.transcript_id || body.id;
      if (!id) return json({ ok: true, skip: "sem id" });
      const { data: t } = await supabase.from("media_transcriptions").select("provider_job_id").eq("id", id).maybeSingle();
      const job = t?.provider_job_id || jobId;
      if (!job) return json({ ok: true, skip: "sem job" });
      return json(await coletar(supabase, id, job));
    }

    if (action === "reconcile") {
      // rede de segurança: webhook pode falhar, então varremos os pendentes
      const { data: pend } = await supabase.from("media_transcriptions")
        .select("id, provider_job_id, created_at")
        .eq("status", "processing").not("provider_job_id", "is", null).limit(20);
      const res: any[] = [];
      for (const p of pend || []) {
        res.push({ id: p.id, ...(await coletar(supabase, p.id, p.provider_job_id)) });
      }
      return json({ ok: true, verificados: res.length, res });
    }

    if (action === "summarize") {
      await resumir(supabase, body.transcription_id);
      return json({ ok: true });
    }

    return json({ error: "ação inválida" }, 400);
  } catch (e) {
    console.error("[transcribe-media]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
