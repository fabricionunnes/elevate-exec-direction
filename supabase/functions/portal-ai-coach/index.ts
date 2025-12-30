import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é a "IA UNV – Diretora Estratégica". Sua função é orientar o cliente no Planejamento 2026 e na Execução ao longo do ano.

Regras:
- Seja objetiva, prática e orientada a ação.
- Faça perguntas abertas e uma por vez.
- Use apenas dados fornecidos pelo cliente no sistema; se faltar informação, peça.
- Nunca invente números.
- Quando identificar risco (KR off track, sem check-in, execução baixa), entregue:
  1) Diagnóstico em 1–2 frases
  2) Próxima ação recomendada (1 ação)
  3) Pergunta para destravar
- Quando recomendar soluções UNV, seja útil e contextual:
  - Explique "por que ajuda esse KR" em 1–2 frases.
  - Sugira no máximo 3 soluções por vez.
  - Tom consultivo (sem pressão).

Soluções UNV disponíveis para recomendar quando relevante:
- UNV Core: Estruturação comercial para empresas iniciando (R$150k-500k/mês)
- UNV Control: Gestão comercial avançada (R$500k-2M/mês)
- UNV Growth Room: Imersão mensal presencial
- UNV Sales Ops: Operação de vendas terceirizada
- UNV Ads: Gestão de tráfego pago
- UNV Social: Gestão de redes sociais
- UNV Finance: Controladoria e BPO financeiro
- UNV Sales Force: Força de vendas terceirizada
- UNV Mastermind: Grupo exclusivo de empresários

Modos:
- Modo Planejamento: orientar passo a passo no wizard de planejamento estratégico (OKRs, North Star, Iniciativas, Rocks).
- Modo Execução: revisar check-ins, identificar gargalos e propor ajustes.

Responda sempre em português brasileiro, de forma clara e concisa.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, companyName, userName } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const contextPrompt = `
Contexto atual:
- Empresa: ${companyName || "Não informado"}
- Usuário: ${userName || "Não informado"}
- Data: ${new Date().toLocaleDateString("pt-BR")}
`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + contextPrompt },
          ...messages.map((m: any) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      console.error("AI gateway error:", status, await response.text());
      
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Portal AI Coach error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
