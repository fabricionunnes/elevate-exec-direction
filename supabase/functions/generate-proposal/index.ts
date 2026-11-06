// generate-proposal: a partir da transcrição da reunião + serviço selecionado (e suas entregas),
// a IA monta o CONTEÚDO de uma proposta comercial premium da UNV Holdings (multi-seção).
// Valores e forma de pagamento são EXTRAÍDOS da transcrição (nunca inventados).
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MODEL = "claude-sonnet-4-6";
const MODELO_OPENAI = "gpt-4o";

// Gemini (06/11/2026): terceira opção, só entra se existir GEMINI_API_KEY nos segredos
async function gemini(prompt: string, maxTokens: number, json: boolean): Promise<{ texto: string; inTok: number; outTok: number }> {
  const chave = Deno.env.get("GEMINI_API_KEY") || "";
  if (!chave) throw new Error("Sem GEMINI_API_KEY");
  const modelo = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3, ...(json ? { responseMimeType: "application/json" } : {}) } }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  // deno-lint-ignore no-explicit-any
  const texto = (d?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("").trim();
  return { texto, inTok: d?.usageMetadata?.promptTokenCount || 0, outTok: d?.usageMetadata?.candidatesTokenCount || 0 };
}

// 06/11/2026: a conta da Anthropic ficou sem crédito e a proposta parou de sair. Agora tenta a
// Anthropic e, se falhar (sem crédito, fora do ar, sem chave), gera pelo OpenAI e depois pelo Gemini, com o mesmo prompt.
async function chamarIA(prompt: string, maxTokens: number): Promise<string> {
  const anthropic = Deno.env.get("ANTHROPIC_API_KEY");
  const openai = Deno.env.get("OPENAI_API_KEY");
  let erroAnthropic = "";
  if (anthropic) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropic, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
    });
    if (r.ok) { const d = await r.json(); return (d?.content?.[0]?.text || "").trim(); }
    erroAnthropic = `Anthropic ${r.status}: ${truncate(await r.text(), 200)}`;
    console.error("generate-proposal", erroAnthropic);
  }
  let erroOpenai = "";
  if (openai) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openai}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODELO_OPENAI, max_tokens: maxTokens, temperature: 0.4, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }),
    });
    if (r.ok) { const d = await r.json(); return String(d?.choices?.[0]?.message?.content || "").trim(); }
    erroOpenai = `OpenAI ${r.status}: ${truncate(await r.text(), 200)}`;
    console.error("generate-proposal", erroOpenai);
  }
  // terceira opção: Gemini
  try { return (await gemini(prompt, maxTokens, true)).texto; }
  catch (e) { throw new Error([erroAnthropic, erroOpenai, (e as Error).message].filter(Boolean).join(" | ") || "Nenhuma chave de IA configurada"); }
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  const t = String(s).trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

// Mantém INÍCIO + FIM da transcrição. O valor/forma de pagamento quase sempre é
// combinado no final da reunião — cortar só o começo perdia o preço.
function headTail(s: string | null | undefined, n: number): string {
  const t = String(s || "").trim();
  if (t.length <= n) return t;
  const head = Math.floor(n * 0.55);
  const tail = n - head;
  return t.slice(0, head) + "\n\n[…trecho do meio omitido…]\n\n" + t.slice(t.length - tail);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {

    const body = await req.json().catch(() => ({}));
    const transcription: string = body.transcription || "";
    const serviceName: string = body.serviceName || "";
    const deliverables: string[] = Array.isArray(body.deliverables) ? body.deliverables : [];
    const leadName: string = body.leadName || "";
    const companyName: string = body.companyName || "";
    // Modo REVISÃO: aplica mudanças ditadas pelo vendedor em cima da proposta atual
    const baseProposal = body.baseProposal || null;
    const instructions: string = String(body.instructions || "").trim();

    if (baseProposal && instructions) {
      const revPrompt = `Você é o diretor comercial da UNV Holdings revisando uma PROPOSTA COMERCIAL já gerada. Abaixo está o JSON da proposta ATUAL e as MUDANÇAS pedidas pelo vendedor.

PROPOSTA ATUAL (JSON):
${JSON.stringify(baseProposal, null, 2)}

MUDANÇAS PEDIDAS PELO VENDEDOR:
${truncate(instructions, 3000)}

REGRAS:
- Aplique EXATAMENTE as mudanças pedidas (valor, nome da empresa, entregas, prazos, texto — o que for).
- O pedido do vendedor é a FONTE DE VERDADE: se ele disser que o valor é R$X, o valor é R$X.
- Tudo que o vendedor NÃO pediu pra mudar, mantenha IGUAL (copie do JSON atual).
- Se uma mudança afetar a coerência de outro trecho (ex.: mudou o serviço → ajuste solucao_intro), ajuste o mínimo necessário.
- NUNCA invente valores ou fatos que não estão nem na proposta atual nem no pedido.
- Mantenha o estilo: direto, de dono, consultivo, português do Brasil.

Responda APENAS com o JSON COMPLETO da proposta revisada, no MESMO formato/chaves do JSON atual (sem markdown, sem comentários).`;

      let revRaw = ((await chamarIA(revPrompt, 3000)) || "{}").trim().replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
      let revised: any;
      try { revised = JSON.parse(revRaw); } catch { const m = revRaw.match(/\{[\s\S]*\}/); revised = m ? JSON.parse(m[0]) : null; }
      if (!revised) throw new Error("Não consegui aplicar as mudanças na proposta");
      const arrR = (k: string) => { if (!Array.isArray(revised[k])) revised[k] = revised[k] ? [revised[k]] : []; };
      ["diagnostico", "antes_depois", "entregas", "proximos_passos"].forEach(arrR);
      revised.servico = revised.servico || baseProposal.servico || serviceName || "";
      return new Response(JSON.stringify({ proposal: revised }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!transcription.trim()) throw new Error("transcription é obrigatória");

    const ctx = {
      cliente: leadName,
      empresa: companyName,
      servico_selecionado: serviceName || "(não definido)",
      entregas_do_servico: deliverables,
      transcricao: headTail(transcription, 48000),
    };

    const prompt = `Você é o diretor comercial da UNV Holdings escrevendo uma PROPOSTA COMERCIAL premium e personalizada, a partir da transcrição de uma reunião de vendas. A UNV Holdings é direção comercial terceirizada para PMEs (estrutura time, processo e gestão e faz a empresa bater meta com previsibilidade).

Estilo de escrita: direto, de dono, consultivo, sem clichê, sem enrolação, português do Brasil. Frases curtas e fortes. Use o que o cliente FALOU na reunião (dores, números, contexto, segmento). Não invente fatos.

Dados (JSON):
${JSON.stringify(ctx, null, 2)}

REGRAS:
- VALOR e FORMA DE PAGAMENTO: o valor quase SEMPRE é combinado no FINAL da reunião — procure com atenção no trecho final. Reconheça formas como "fica em R$X", "R$X por ano", "X por mês", "em 12x de R$Y", "dividido em N vezes", "à vista", "no cartão", "no pix", "contrato mínimo de N meses", "setup de R$Z". Extraia EXATAMENTE o que foi dito. Se a pessoa falou valor anual E o mensal (ex.: "24.000 por ano, dividido em 12x de 2.000 por mês"), coloque o valor de forma clara (ex.: investimento "R$ 2.000/mês (R$ 24.000/ano)") e a forma ("12x"). Só use "A combinar" se REALMENTE não houver nenhum valor dito. NUNCA invente preço.
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
  "investimento": "APENAS o valor principal, curto (ex.: 'R$ 2.000/mês', 'R$ 24.000/ano', 'R$ 3.000/mês'). NÃO coloque aqui condições, créditos, devoluções nem parcelamento — isso vai em forma_pagamento. OU 'A combinar'",
  "forma_pagamento": "condições em frase(s) curta(s): parcelamento, crédito/devolução negociada, carência, setup, mudança de valor a partir de tal mês. Ex.: '3 primeiros meses sem custo (crédito de R$ 6.000 existente); a partir do 4º mês R$ 3.000/mês, renegociável'. OU 'A combinar'",
  "prazo": "prazo/vigência se mencionado, senão ''",
  "proximos_passos": [{"titulo": "string curto", "descricao": "1 frase"}],
  "cta": "uma frase de fechamento (ex.: 'Quando quiser bater meta todo mês — é só chamar.')"
}`;

    let raw = ((await chamarIA(prompt, 3000)) || "{}").trim().replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
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
