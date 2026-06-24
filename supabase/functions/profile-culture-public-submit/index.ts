// profile-culture-public-submit: recebe o quiz Likert (com pillar/reverse/value) + a
// resposta aberta, calcula a nota por pilar e o fit geral, e usa a IA pra avaliar a
// resposta aberta contra a cultura UNV. Grava em profile_culture_results.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MODEL = "claude-sonnet-4-6";

const PILLAR_LABELS: Record<string, string> = {
  resultado: "Orientação a Resultado", dono: "Visão de Dono", processo: "Disciplina de Processo",
  velocidade: "Velocidade / Execução", profundidade: "Profundidade (vai à raiz, anti-superficial)",
};

interface Ans { id: number; pillar: string; reverse: boolean; value: number; }

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  const t = String(s).trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const tenantId: string | null = body.tenantId ?? null;
    const candidateId: string | null = body.candidateId ?? null;
    const name: string = (body.name || "").trim();
    const answers: Ans[] = Array.isArray(body.answers) ? body.answers : [];
    const openAnswer: string = (body.openAnswer || "").trim();

    if (!name) throw new Error("name_required");
    if (!answers.length) throw new Error("answers_required");

    // Nota por pilar: value 1-5 (reverse => 6-value) -> média -> (m-1)/4*100
    const byPillar: Record<string, number[]> = {};
    for (const a of answers) {
      const v = a.reverse ? 6 - Number(a.value) : Number(a.value);
      if (!a.pillar || !Number.isFinite(v)) continue;
      (byPillar[a.pillar] ||= []).push(v);
    }
    const pillarScores: Record<string, number> = {};
    for (const [p, arr] of Object.entries(byPillar)) {
      const avg = arr.reduce((s, x) => s + x, 0) / arr.length;
      pillarScores[p] = Math.max(0, Math.min(100, Math.round(((avg - 1) / 4) * 100)));
    }
    const vals = Object.values(pillarScores);
    const fitScore = vals.length ? Math.round(vals.reduce((s, x) => s + x, 0) / vals.length) : 0;

    // IA avalia a resposta aberta contra a cultura UNV
    let aiScore: number | null = null;
    let aiSummary = "";
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (openAnswer && ANTHROPIC_API_KEY) {
      try {
        const prompt = `Você avalia o FIT CULTURAL de um candidato com a UNV (Universidade Nacional de Vendas), uma empresa extremamente orientada a resultado, com mentalidade de dono, disciplina de processo, execução rápida e profundidade (anti-superficial).

Pergunta feita ao candidato: "Conte uma situação real em que precisou bater uma meta difícil ou resolver um problema sozinho. O que fez e qual o resultado?"

Resposta do candidato:
"""${truncate(openAnswer, 4000)}"""

Avalie o quanto a resposta demonstra os valores da UNV (resultado, dono, processo, execução, profundidade). Seja direto e honesto, sem elogio vazio. Se a resposta for vaga/genérica, pontue baixo.

Responda APENAS um JSON válido em português:
{ "score": <inteiro 0-100 de fit cultural>, "resumo": "<1-2 frases diretas sobre o fit cultural dele>" }`;

        const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
          body: JSON.stringify({ model: MODEL, max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          let raw = (aiData?.content?.[0]?.text || "{}").trim().replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
          let parsed: any;
          try { parsed = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; }
          if (parsed) {
            aiScore = Math.max(0, Math.min(100, parseInt(parsed.score, 10) || 0));
            aiSummary = String(parsed.resumo || "").trim();
          }
        }
      } catch { /* segue sem IA */ }
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await supabase.from("profile_culture_results").insert({
      candidate_id: candidateId,
      tenant_id: tenantId,
      pillar_scores: pillarScores,
      fit_score: fitScore,
      ai_score: aiScore,
      ai_summary: aiSummary || null,
      open_answer: openAnswer || null,
      raw_responses: answers,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, fitScore, pillarScores, aiScore }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
