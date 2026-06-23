// profile-candidate-analyze: avalia a ADERÊNCIA de um candidato à vaga.
// Cruza requisitos da vaga (profile_jobs) com os dados do candidato + perfil DISC
// (profile_disc_results) e devolve nota 0-100, veredito, pontos fortes/atenção e
// recomendação. Grava em profile_candidates (ai_score/ai_summary/ai_strengths/ai_concerns).
// Observação: o currículo é um arquivo (PDF/imagem) e NÃO é lido aqui — a análise
// usa dados estruturados + carta de apresentação + DISC. O recrutador lê o currículo.
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

const DISC_NAMES: Record<string, string> = { D: "Dominância", I: "Influência", S: "Estabilidade", C: "Conformidade" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada");

    const body = await req.json().catch(() => ({}));
    const candidateId: string = body.candidateId || "";
    if (!candidateId) throw new Error("candidateId obrigatório");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cand, error: cErr } = await supabase
      .from("profile_candidates")
      .select("id,job_id,full_name,email,phone,city,state,linkedin_url,cover_letter")
      .eq("id", candidateId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!cand) throw new Error("Candidato não encontrado");

    const { data: job } = cand.job_id
      ? await supabase.from("profile_jobs").select("title,area,seniority,contract_model,description,requirements").eq("id", cand.job_id).maybeSingle()
      : { data: null };

    const { data: disc } = await supabase
      .from("profile_disc_results")
      .select("d_score,i_score,s_score,c_score,dominant,taken_at")
      .eq("candidate_id", candidateId)
      .order("taken_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const discTxt = disc
      ? `Perfil DISC: dominante ${disc.dominant} (${DISC_NAMES[disc.dominant] || disc.dominant}). Scores — D:${disc.d_score} I:${disc.i_score} S:${disc.s_score} C:${disc.c_score}.`
      : "Perfil DISC: candidato ainda não fez o teste.";

    const prompt = `Você é um diretor comercial e recrutador sênior da UNV. Avalie de forma DIRETA e honesta a aderência deste candidato à vaga. Sem enrolação, sem elogio vazio. Foque no que importa pra performance no cargo.

VAGA:
- Cargo: ${truncate(job?.title, 120) || "—"}
- Área: ${truncate(job?.area, 80) || "—"}
- Senioridade: ${truncate(job?.seniority, 40) || "—"}
- Contrato: ${truncate(job?.contract_model, 40) || "—"}
- Descrição: ${truncate(job?.description, 1500) || "—"}
- Requisitos: ${truncate(job?.requirements, 1500) || "—"}

CANDIDATO:
- Nome: ${truncate(cand.full_name, 120)}
- Localização: ${[cand.city, cand.state].filter(Boolean).join("/") || "—"}
- LinkedIn: ${truncate(cand.linkedin_url, 200) || "—"}
- Carta/mensagem: ${truncate(cand.cover_letter, 2000) || "—"}
- ${discTxt}

Considere que o currículo em arquivo NÃO foi lido — baseie-se nos dados acima. Se faltar informação relevante (ex.: experiência específica), aponte como ponto de atenção, não invente.

Responda APENAS com um JSON válido, em português, neste formato:
{
  "score": <inteiro 0-100 de aderência à vaga>,
  "veredito": "<1 frase direta dizendo se vale avançar e por quê>",
  "pontos_fortes": ["<ponto>", "..."],
  "pontos_atencao": ["<ponto/risco/lacuna>", "..."],
  "fit_comportamental": "<1 frase: o DISC dele combina com o que o cargo exige? Se não houver DISC, diga que falta o teste>",
  "recomendacao": "<avancar | avaliar | descartar>"
}`;

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
    let analysis: any;
    try { analysis = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); analysis = m ? JSON.parse(m[0]) : null; }
    if (!analysis) throw new Error("Não consegui interpretar a análise");

    const score = Math.max(0, Math.min(100, parseInt(analysis.score, 10) || 0));
    const strengths = Array.isArray(analysis.pontos_fortes) ? analysis.pontos_fortes : [];
    const concerns = Array.isArray(analysis.pontos_atencao) ? analysis.pontos_atencao : [];
    const summary = String(analysis.veredito || "").trim();

    await supabase.from("profile_candidates").update({
      ai_score: score,
      ai_summary: summary,
      ai_strengths: strengths,
      ai_concerns: concerns,
    }).eq("id", candidateId);

    return new Response(JSON.stringify({
      analysis: {
        score, veredito: summary,
        pontos_fortes: strengths, pontos_atencao: concerns,
        fit_comportamental: String(analysis.fit_comportamental || "").trim(),
        recomendacao: String(analysis.recomendacao || "").trim().toLowerCase(),
        tem_disc: !!disc,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
