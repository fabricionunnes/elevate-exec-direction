// dialer-coach: avalia o atendimento do SDR em cada ligação (nota + pontos fortes + o que melhorar),
// pela ótica da metodologia UNV. Grava em crm_calls.qa_score/qa_feedback. Chamado pelo dialer-qualify
// (por ligação) e pelo painel Coach (backfill em lote).
import { createClient } from "@supabase/supabase-js";

const MODEL = "claude-sonnet-4-6";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function truncate(s: string | null | undefined, n: number): string { const t = s || ""; return t.length > n ? t.slice(0, n) + "…" : t; }

const UNV_CONTEXT = `Sobre a UNV (contexto pra avaliar): a UNV é terceirização de gestão comercial — atua como diretor comercial das empresas dos clientes, estruturando time, processo e previsibilidade de vendas. Filosofia de prospecção: consultiva e diagnóstica, NUNCA começa vendendo ("venda é consequência, não pressão"). O objetivo de uma ligação de prospecção da SDR é: criar rapport rápido, DIAGNOSTICAR o cenário e a dor do lead (não bate meta, falta previsibilidade, baixa conversão, ticket baixo, dependência do dono), QUALIFICAR pelo ICP (tem ao menos 1 vendedor e fatura acima de ~R$50 mil/mês) e CONDUZIR pra um próximo passo claro — idealmente agendar uma reunião de diagnóstico. Tom: direto, humano, sem enrolação e sem pressão.`;

async function coachCall(supabase: any, anthropicKey: string, callId: string): Promise<{ ok: boolean; reason?: string }> {
  const { data: call } = await supabase
    .from("crm_calls")
    .select("id, lead_id, agent_staff_id, duration_seconds, answered_by, transcription, qa_score, lead:crm_leads(name, company, segment, main_pain)")
    .eq("id", callId)
    .maybeSingle();
  if (!call) return { ok: false, reason: "call_not_found" };
  if (call.answered_by !== "human" || !call.transcription || call.transcription.trim().length < 40) {
    return { ok: false, reason: "sem_conversa" }; // só avalia conversa real com transcrição
  }

  const ctx = {
    lead: { nome: call.lead?.name, empresa: call.lead?.company, segmento: call.lead?.segment, dor: call.lead?.main_pain },
    duracao_segundos: call.duration_seconds,
    transcricao: truncate(call.transcription, 12000),
  };

  const prompt = `Você é gerente comercial da UNV avaliando a performance da SDR numa ligação de prospecção, pra dar uma nota e um coaching prático.
${UNV_CONTEXT}

Avalie a ligação nestes eixos: abertura/rapport, descoberta e diagnóstico (fez as perguntas certas?), escuta ativa, condução e controle da ligação, qualificação pelo ICP, e fechamento de próximo passo (agendou?). Tom consultivo, sem pressão, conta pontos.

Dados da ligação (JSON):
${JSON.stringify(ctx, null, 2)}

Responda APENAS com JSON válido (sem markdown):
{
  "nota_atendimento": número de 0 a 10 (uma casa decimal),
  "resumo": "1 a 2 frases sobre como foi o atendimento da SDR",
  "pontos_fortes": ["2 a 3 itens curtos do que a SDR fez bem"],
  "pontos_melhorar": ["2 a 3 itens curtos e ACIONÁVEIS do que melhorar na próxima"],
  "dica_principal": "1 frase: a mudança que mais aumentaria o resultado",
  "frase_modelo": "uma frase/abordagem exemplar que a SDR poderia ter usado neste caso (estilo UNV)"
}
Regras: avalie só pelo que aparece na transcrição, não invente. Seja específico e direto. Português do Brasil.`;

  const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1200, messages: [{ role: "user", content: prompt }] }),
  });
  if (!aiResp.ok) return { ok: false, reason: `anthropic_${aiResp.status}` };
  const aiData = await aiResp.json();
  let rawTxt = (aiData?.content?.[0]?.text || "{}").trim().replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
  let q: any;
  try { q = JSON.parse(rawTxt); } catch { const m = rawTxt.match(/\{[\s\S]*\}/); q = m ? JSON.parse(m[0]) : null; }
  if (!q) return { ok: false, reason: "parse" };
  let nota = Number(q.nota_atendimento);
  if (Number.isNaN(nota)) nota = null as any; else nota = Math.max(0, Math.min(10, Math.round(nota * 10) / 10));

  await supabase.from("crm_calls").update({
    qa_score: nota,
    qa_feedback: {
      resumo: q.resumo || null,
      pontos_fortes: Array.isArray(q.pontos_fortes) ? q.pontos_fortes : [],
      pontos_melhorar: Array.isArray(q.pontos_melhorar) ? q.pontos_melhorar : [],
      dica_principal: q.dica_principal || null,
      frase_modelo: q.frase_modelo || null,
    },
    qa_at: new Date().toISOString(),
  }).eq("id", callId);
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return json({ error: "ANTHROPIC_API_KEY não configurada" }, 500);

    const body = await req.json().catch(() => ({}));

    // modo 1 ligação (chamado pelo dialer-qualify, service role)
    if (body.callId) {
      const r = await coachCall(supabase, anthropicKey, body.callId);
      return json(r);
    }

    // modo lote (painel Coach): exige staff; UNV vê tudo, gestor de cliente só o seu tenant
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await supabase.auth.getUser(jwt);
    const uid = u?.user?.id;
    const { data: me } = uid ? await supabase.from("onboarding_staff").select("role, tenant_id, is_active").eq("user_id", uid).maybeSingle() : { data: null };
    if (!me || !me.is_active) return json({ error: "Não autorizado" }, 403);
    const scopeTenant = (!me.tenant_id && ["master", "admin", "head_comercial"].includes(me.role)) ? null : (me.tenant_id || null);

    const limit = Math.min(Math.max(Number(body.limit) || 8, 1), 20);
    let q = supabase.from("crm_calls")
      .select("id")
      .eq("answered_by", "human")
      .not("transcription", "is", null)
      .is("qa_score", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (scopeTenant) q = q.eq("tenant_id", scopeTenant);
    const { data: pend } = await q;
    const ids = (pend || []).map((c: any) => c.id);
    let scored = 0;
    for (const id of ids) { const r = await coachCall(supabase, anthropicKey, id); if (r.ok) scored++; }
    return json({ scored, processed: ids.length });
  } catch (error: any) {
    return json({ error: error?.message || String(error) }, 500);
  }

  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
