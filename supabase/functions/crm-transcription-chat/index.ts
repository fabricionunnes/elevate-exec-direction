import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user via getClaims
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { leadId, question, conversationHistory } = await req.json();

    if (!leadId || !question) {
      return new Response(JSON.stringify({ error: "leadId e question são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all transcriptions for this lead
    const { data: transcriptions, error: txError } = await supabase
      .from("crm_transcriptions")
      .select("id, title, transcription_text, ai_analysis, source, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });

    if (txError) {
      console.error("Error fetching transcriptions:", txError);
      throw new Error("Erro ao buscar transcrições");
    }

    // Fetch lead basic info
    const { data: lead } = await supabase
      .from("crm_leads")
      .select("name, company, phone, email, notes, opportunity_value")
      .eq("id", leadId)
      .single();

    // Build context
    let context = "";
    if (lead) {
      context += `## Dados do Lead\n`;
      context += `- Nome: ${lead.name || "N/A"}\n`;
      context += `- Empresa: ${lead.company || "N/A"}\n`;
      context += `- Telefone: ${lead.phone || "N/A"}\n`;
      context += `- E-mail: ${lead.email || "N/A"}\n`;
      if (lead.opportunity_value) context += `- Valor: R$ ${(lead.opportunity_value / 1).toLocaleString("pt-BR")}\n`;
      if (lead.notes) context += `- Observações: ${lead.notes}\n`;
      context += "\n";
    }

    if (transcriptions && transcriptions.length > 0) {
      context += `## Transcrições (${transcriptions.length} encontradas)\n\n`;
      for (const tx of transcriptions) {
        context += `### ${tx.title || "Sem título"} (${new Date(tx.created_at).toLocaleDateString("pt-BR")})\n`;
        if (tx.transcription_text) {
          context += `**Texto da transcrição:**\n${tx.transcription_text}\n\n`;
        }
        if (tx.ai_analysis) {
          context += `**Análise da IA:**\n${tx.ai_analysis}\n\n`;
        }
      }
    } else {
      context += "## Transcrições\nNenhuma transcrição encontrada para este lead.\n";
    }

    // Fetch lead summaries if available
    const { data: summaries } = await supabase
      .from("crm_lead_summaries")
      .select("tab_type, content")
      .eq("lead_id", leadId);

    if (summaries && summaries.length > 0) {
      context += "\n## Resumos já gerados\n";
      for (const s of summaries) {
        context += `### ${s.tab_type}\n${s.content}\n\n`;
      }
    }

    const systemPrompt = `Você é um assistente de vendas especializado em análise de conversas comerciais. Você tem acesso completo às transcrições de ligações/reuniões de um lead e aos dados do negócio.

Seu papel é:
- Responder perguntas sobre o que foi discutido nas conversas
- Identificar objeções, interesses, pontos de dor e oportunidades
- Sugerir estratégias de abordagem baseadas no que foi dito
- Resumir pontos específicos quando solicitado
- Dar insights sobre o perfil do lead baseado nas interações

Responda SEMPRE em português brasileiro. Seja direto e objetivo. Use formatação Markdown quando apropriado.

Contexto completo do lead e suas transcrições:

${context}`;

    // Build messages array
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: question });

    // Call Lovable AI Gateway with streaming
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      throw new Error("Erro ao consultar IA");
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("crm-transcription-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
