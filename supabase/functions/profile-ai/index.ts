// profile-ai - UNV Profile AI tools using Lovable AI Gateway
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPTS: Record<string, string> = {
  candidate_analysis: "Você é um recrutador sênior de RH. Analise o candidato fornecido (currículo, perfil DISC, respostas) frente à vaga e gere um relatório objetivo em português brasileiro com: (1) Score de aderência 0-100, (2) Pontos fortes, (3) Pontos de atenção, (4) Recomendação final (Avançar / Manter em banco / Não recomendado), (5) Perguntas sugeridas para entrevista.",
  pdi_suggestion: "Você é um especialista em desenvolvimento humano. Com base no perfil DISC, cargo atual, desempenho e plano de carreira do colaborador, gere um PDI estruturado em português com: Objetivo, 3-5 ações de desenvolvimento (com prazo sugerido), competências a desenvolver, indicadores de sucesso e recursos recomendados.",
  promotion_suggestion: "Você é um consultor de gestão de pessoas. Avalie os colaboradores fornecidos e identifique os prontos para promoção. Para cada um responda: nome, cargo atual, próximo nível sugerido, justificativa baseada em performance/comportamento, riscos e plano de transição. Em português.",
  turnover_risk: "Você é um analista de people analytics. Identifique colaboradores em risco de turnover com base nos dados (clima, performance, engajamento, feedbacks). Para cada um: nome, nível de risco (Alto/Médio/Baixo), sinais identificados, ações de retenção recomendadas. Em português.",
  feedback_generation: "Você é um líder experiente. Gere um feedback estruturado e construtivo (modelo SCI - Situação, Comportamento, Impacto) em português brasileiro, com tom respeitoso e orientado a desenvolvimento. Inclua reconhecimentos, pontos a melhorar e próximos passos.",
  strategic_crossing: "Você é um diretor de RH estratégico. Cruze os dados de performance, comportamento (DISC) e cultura para gerar insights acionáveis em português: tendências, gargalos organizacionais, oportunidades, recomendações priorizadas para a liderança.",
};

async function callAI(systemPrompt: string, userPrompt: string) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 429) throw new Error("RATE_LIMIT");
    if (resp.status === 402) throw new Error("PAYMENT_REQUIRED");
    throw new Error(`AI Gateway error: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { tool, context, customPrompt } = await req.json();
    if (!tool || !SYSTEM_PROMPTS[tool]) {
      return new Response(JSON.stringify({ error: "Ferramenta inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Build context based on tool
    let contextData = "";
    if (tool === "promotion_suggestion" || tool === "turnover_risk" || tool === "strategic_crossing") {
      const { data: employees } = await admin
        .from("profile_employees")
        .select("id, full_name, email, position_id, department_id, hire_date, status")
        .eq("status", "active")
        .limit(50);
      const { data: discs } = await admin.from("profile_disc_results").select("employee_id, profile, scores").limit(100);
      const { data: positions } = await admin.from("profile_positions").select("id, name, level").limit(100);
      const { data: feedbacks } = await admin.from("profile_feedbacks").select("to_id, type, content, created_at").order("created_at", { ascending: false }).limit(100);
      const { data: climate } = await admin.from("profile_climate_responses").select("answers, created_at").order("created_at", { ascending: false }).limit(50);
      contextData = `Colaboradores ativos:\n${JSON.stringify(employees || [], null, 2)}\n\nResultados DISC:\n${JSON.stringify(discs || [], null, 2)}\n\nCargos:\n${JSON.stringify(positions || [], null, 2)}\n\nFeedbacks recentes:\n${JSON.stringify(feedbacks || [], null, 2)}\n\nRespostas de clima recentes:\n${JSON.stringify(climate || [], null, 2)}`;
    }

    const userPrompt = `${contextData ? `DADOS DA EMPRESA:\n${contextData}\n\n` : ""}${context ? `CONTEXTO:\n${typeof context === "string" ? context : JSON.stringify(context, null, 2)}\n\n` : ""}${customPrompt ? `SOLICITAÇÃO ADICIONAL:\n${customPrompt}\n\n` : ""}Gere a análise solicitada.`;

    const result = await callAI(SYSTEM_PROMPTS[tool], userPrompt);
    return new Response(JSON.stringify({ result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    const msg = e?.message || "Erro";
    if (msg === "RATE_LIMIT") return new Response(JSON.stringify({ error: "Limite de requisições atingido. Aguarde alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (msg === "PAYMENT_REQUIRED") return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    console.error("profile-ai error", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
