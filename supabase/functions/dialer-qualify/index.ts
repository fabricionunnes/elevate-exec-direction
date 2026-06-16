// dialer-qualify: baixa a gravação, transcreve (OpenAI Whisper) e a IA (Claude) qualifica,
// escrevendo resumo, disposição e atualizando o cadastro do lead.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MODEL = "claude-sonnet-4-6";

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  const t = String(s).trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    const body = await req.json().catch(() => ({}));

    // Modo verificação: confere se a OPENAI_API_KEY está válida (sem precisar de gravação)
    if (body.verify) {
      if (!OPENAI_API_KEY) return new Response(JSON.stringify({ verify: true, openai_key_set: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } });
      return new Response(JSON.stringify({ verify: true, openai_key_set: true, openai_ok: r.ok, openai_status: r.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callId: string | undefined = body.callId;
    if (!callId) throw new Error("callId é obrigatório");

    const { data: call } = await supabase
      .from("crm_calls")
      .select("id, lead_id, activity_id, recording_url, duration_seconds, transcription")
      .eq("id", callId)
      .maybeSingle();
    if (!call) throw new Error("Ligação não encontrada");

    const { data: lead } = await supabase
      .from("crm_leads")
      .select("id, name, company, segment, estimated_revenue, employee_count, main_pain, urgency, fit_score, notes")
      .eq("id", call.lead_id)
      .maybeSingle();

    // 1) Transcrição (Whisper) se houver gravação + chave OpenAI
    let transcription = call.transcription || "";
    if (!transcription && call.recording_url && OPENAI_API_KEY && accountSid && authToken) {
      try {
        const audioResp = await fetch(call.recording_url, {
          headers: { Authorization: "Basic " + btoa(`${accountSid}:${authToken}`) },
        });
        if (audioResp.ok) {
          const audioBlob = await audioResp.blob();
          const fd = new FormData();
          fd.append("file", audioBlob, "call.mp3");
          fd.append("model", "whisper-1");
          fd.append("language", "pt");
          const wResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
            body: fd,
          });
          const wData = await wResp.json();
          if (wResp.ok) transcription = wData.text || "";
        }
      } catch (_e) { /* segue sem transcrição */ }
      if (transcription) {
        await supabase.from("crm_calls").update({ transcription }).eq("id", callId);
      }
    }

    // 2) Qualificação com Claude
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada");

    const ctx = {
      lead: {
        nome: lead?.name, empresa: lead?.company, segmento: lead?.segment,
        faturamento: lead?.estimated_revenue, funcionarios: lead?.employee_count,
        dor: lead?.main_pain, urgencia: lead?.urgency, fit_score: lead?.fit_score,
      },
      duracao_segundos: call.duration_seconds,
      transcricao: transcription ? truncate(transcription, 12000) : null,
    };

    const prompt = `Você é analista comercial da UNV. Abaixo está o registro de uma ligação de prospecção feita pela SDR. ${transcription ? "Use a TRANSCRIÇÃO para qualificar." : "NÃO há transcrição disponível (sem áudio transcrito) — qualifique de forma conservadora apenas pelo que já se sabe e marque a disposição como 'sem_transcricao'."}

Dados (JSON):
${JSON.stringify(ctx, null, 2)}

Responda APENAS com JSON válido (sem markdown):
{
  "resumo": "3 a 5 frases objetivas do que rolou na ligação e do estágio comercial",
  "disposicao": "qualificado | agendou_reuniao | retornar_depois | sem_interesse | nao_qualificado | nao_atendeu | sem_transcricao",
  "observacoes": "anotações que devem ir pro CRM, prontas pra próxima abordagem",
  "fit_score": número de 0 a 100 (ou null se não der pra avaliar),
  "urgencia": "alta | media | baixa | desconhecida",
  "campos_atualizados": {
    "segment": "valor ou null", "estimated_revenue": "valor ou null",
    "employee_count": "valor ou null", "main_pain": "valor ou null"
  },
  "proximo_passo": "ação recomendada"
}
Regras: não invente dados que não aparecem. Português do Brasil.`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
    });
    if (!aiResp.ok) throw new Error(`Anthropic ${aiResp.status}: ${truncate(await aiResp.text(), 300)}`);
    const aiData = await aiResp.json();
    let raw = (aiData?.content?.[0]?.text || "{}").trim().replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
    let q: any;
    try { q = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); q = m ? JSON.parse(m[0]) : { resumo: raw }; }

    // 3) Grava na ligação
    await supabase.from("crm_calls").update({
      ai_summary: q.resumo || null,
      ai_disposition: q.disposicao || null,
      ai_qualification: q,
    }).eq("id", callId);

    // 4) Atualiza o lead (append nas notas + campos não nulos)
    if (lead) {
      const stamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const block = `\n\n— Ligação (discador) ${stamp} [${q.disposicao || "—"}]\n${q.observacoes || q.resumo || ""}`.trim();
      const leadPatch: Record<string, unknown> = {
        notes: (lead.notes ? lead.notes + "\n" : "") + block,
      };
      if (typeof q.fit_score === "number") leadPatch.fit_score = q.fit_score;
      if (q.urgencia && ["alta", "media", "baixa"].includes(q.urgencia)) {
        leadPatch.urgency = q.urgencia === "alta" ? "high" : q.urgencia === "media" ? "medium" : "low";
      }
      const cu = q.campos_atualizados || {};
      for (const f of ["segment", "estimated_revenue", "employee_count", "main_pain"]) {
        if (cu[f] && cu[f] !== "null" && !(lead as any)[f]) leadPatch[f] = cu[f];
      }
      await supabase.from("crm_leads").update(leadPatch).eq("id", lead.id);
    }

    // 5) Atualiza a atividade
    if (call.activity_id) {
      await supabase.from("crm_activities").update({
        notes: `[${q.disposicao || "—"}] ${q.resumo || ""}\n\n${q.observacoes || ""}`.trim(),
      }).eq("id", call.activity_id);
    }

    return new Response(JSON.stringify({ ok: true, callId, disposition: q.disposicao, transcribed: !!transcription }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
