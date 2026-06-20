// generate-proposal: a partir da transcrição da reunião + serviço selecionado (e suas entregas),
// a IA monta o CONTEÚDO de uma proposta comercial premium da UNV Holdings (multi-seção).
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
      transcricao: truncate(transcription, 18000),
    };

    const prompt = `Você é o diretor comercial da UNV Holdings escrevendo uma PROPOSTA COMERCIAL premium e personalizada, a partir da transcrição de uma reunião de vendas. A UNV Holdings é direção comercial terceirizada para PMEs (estrutura time, processo e gestão e faz a empresa bater meta com previsibilidade).

Estilo de escrita: direto, de dono, consultivo, sem clichê, sem enrolação, português do Brasil. Frases curtas e fortes. Use o que o cliente FALOU na reunião (dores, números, contexto, segmento). Não invente fatos.

Dados (JSON):
${JSON.stringify(ctx, null, 2)}

REGRAS:
- VALOR e FORMA DE PAGAMENTO: extraia EXATAMENTE o que foi combinado na reunião (ex.: "R$ 7.000/mês", "12x no cartão", "à vista no pix"). Se não houver na transcrição, use "A combinar". NUNCA invente preço.
- "entregas": baseie-se nas entregas_do_servico (pode reescrever cada uma mais clara e aderente ao caso). Se o serviço não foi definido, descreva entregas coerentes com a UNV.
- headline_l1/headline_l2: título de capa em DUAS partes (a 2ª sai em vermelho). Pode ser o nome do serviço quebrado em 2, ou um título forte do que será entregue (ex.: "Diretor Comercial" / "Terceirizado").
- diagnostico: 4 a 6 itens (cada um = uma dor/gargalo dito na reunião).
- antes_depois: 3 itens contrastando o HOJE com a META.
- proximos_passos: 4 a 5 passos objetivos.

Responda APENAS com JSON válido (sem markdown, sem comentários):
{
  "headline_l1": "string",
  "headline_l2": "string",
  "subtitulo": "1 a 2 frases do que a UNV vai ser/fazer para esse cliente específico",
  "quote": "uma frase de efeito (pode ser do dono: 'Posso ser seu diretor comercial, estruturar seu time e fazer você bater meta todos os meses.')",
  "preparado_para_detalhe": "resumo curto do cliente (ex.: 'Academia · 900–1.200 alunos')",
  "diagnostico_titulo": "título curto da seção de diagnóstico (ex.: 'O cenário que ouvimos')",
  "diagnostico": [{"titulo": "string curto", "descricao": "1 a 2 frases"}],
  "virada_frase": "1 frase forte do problema/oportunidade central",
  "antes_depois": [{"hoje": "frase do estado atual", "meta": "frase do estado desejado"}],
  "solucao_intro": "1 a 2 frases introduzindo a solução/serviço",
  "entregas": ["entrega 1", "entrega 2", "..."],
  "investimento": "valor combinado na reunião OU 'A combinar'",
  "forma_pagamento": "forma combinada na reunião OU 'A combinar'",
  "prazo": "prazo/vigência se mencionado, senão ''",
  "proximos_passos": [{"titulo": "string curto", "descricao": "1 frase"}],
  "cta": "uma frase de fechamento (ex.: 'Quando quiser bater meta todo mês — é só chamar.')"
}`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: "user", content: prompt }] }),
    });
    if (!aiResp.ok) throw new Error(`Anthropic ${aiResp.status}: ${truncate(await aiResp.text(), 300)}`);
    const aiData = await aiResp.json();
    let raw = (aiData?.content?.[0]?.text || "{}").trim().replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
    let proposal: any;
    try { proposal = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); proposal = m ? JSON.parse(m[0]) : null; }
    if (!proposal) throw new Error("Não consegui montar a proposta a partir da transcrição");

    // normaliza
    const arr = (k: string) => { if (!Array.isArray(proposal[k])) proposal[k] = proposal[k] ? [proposal[k]] : []; };
    ["diagnostico", "antes_depois", "entregas", "proximos_passos"].forEach(arr);
    if ((!proposal.entregas || proposal.entregas.length === 0) && deliverables.length) proposal.entregas = deliverables;
    proposal.servico = serviceName || proposal.servico || "";

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
