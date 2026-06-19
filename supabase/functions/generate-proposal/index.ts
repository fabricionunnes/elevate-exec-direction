// generate-proposal: a partir da transcrição da reunião + serviço selecionado (e suas entregas),
// a IA monta o conteúdo de uma proposta comercial personalizada da UNV Holdings.
// Valores e forma de pagamento são EXTRAÍDOS da transcrição (nunca inventados).
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
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada");

    const body = await req.json().catch(() => ({}));
    const transcription: string = body.transcription || "";
    const serviceName: string = body.serviceName || "";
    const deliverables: string[] = Array.isArray(body.deliverables) ? body.deliverables : [];
    const leadName: string = body.leadName || "";
    const companyName: string = body.companyName || "";

    if (!transcription.trim()) throw new Error("transcription é obrigatória");

    const ctx = {
      cliente: leadName,
      empresa: companyName,
      servico_selecionado: serviceName || "(não definido)",
      entregas_do_servico: deliverables,
      transcricao: truncate(transcription, 16000),
    };

    const prompt = `Você é o diretor comercial da UNV Holdings montando uma PROPOSTA COMERCIAL personalizada para um cliente, a partir da transcrição de uma reunião de vendas. A UNV Holdings faz terceirização de gestão comercial para empresas (estrutura time, processo e faz bater meta).

Dados (JSON):
${JSON.stringify(ctx, null, 2)}

Regras IMPORTANTES:
- Use a TRANSCRIÇÃO como verdade. Não invente fatos, números, dores ou nomes que não apareçam nela.
- VALOR e FORMA DE PAGAMENTO: extraia EXATAMENTE o que foi combinado/falado na reunião (ex.: "R$ 7.000/mês", "12x no cartão", "à vista no pix"). Se NÃO houver valor/forma claros na transcrição, retorne "A combinar". NUNCA invente preço.
- O serviço da proposta é o "servico_selecionado". Use as "entregas_do_servico" como base das entregas (pode reescrever cada uma de forma mais clara/aderente ao caso, mas sem inventar entregas novas que fujam do serviço). Se o serviço não foi definido, recomende o mais aderente ao que apareceu na reunião e descreva entregas coerentes.
- Tom: direto, consultivo, de dono — sem enrolação, sem clichê, português do Brasil.

Responda APENAS com JSON válido (sem markdown, sem comentários):
{
  "titulo": "Proposta Comercial — <nome do cliente/empresa>",
  "contexto": "2 a 4 frases sobre o momento e o cenário do cliente, com base na reunião",
  "diagnostico": ["dor/gargalo 1 identificado na reunião", "dor 2", "..."],
  "objetivo": "1 a 2 frases do resultado que a UNV vai entregar para esse cliente",
  "servico": "nome do serviço",
  "descricao_servico": "1 a 2 frases do que é o serviço",
  "entregas": ["entrega 1", "entrega 2", "..."],
  "investimento": "valor combinado na reunião OU 'A combinar'",
  "forma_pagamento": "forma combinada na reunião OU 'A combinar'",
  "prazo": "prazo/vigência se mencionado, senão ''",
  "proximos_passos": ["passo 1", "passo 2", "..."]
}`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
    });
    if (!aiResp.ok) throw new Error(`Anthropic ${aiResp.status}: ${truncate(await aiResp.text(), 300)}`);
    const aiData = await aiResp.json();
    let raw = (aiData?.content?.[0]?.text || "{}").trim().replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
    let proposal: any;
    try { proposal = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); proposal = m ? JSON.parse(m[0]) : null; }
    if (!proposal) throw new Error("Não consegui montar a proposta a partir da transcrição");

    // garante arrays
    for (const k of ["diagnostico", "entregas", "proximos_passos"]) {
      if (!Array.isArray(proposal[k])) proposal[k] = proposal[k] ? [String(proposal[k])] : [];
    }
    if (!proposal.servico) proposal.servico = serviceName;
    if ((!proposal.entregas || proposal.entregas.length === 0) && deliverables.length) proposal.entregas = deliverables;

    return new Response(JSON.stringify({ proposal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
