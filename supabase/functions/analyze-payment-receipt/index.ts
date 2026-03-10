import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { media_url, invoices, company_name } = await req.json();

    if (!media_url) {
      return new Response(
        JSON.stringify({ error: "media_url é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!invoices || invoices.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma fatura para comparar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build invoice list for the prompt
    const invoiceList = invoices.map((inv: any) =>
      `- ID: ${inv.id} | Descrição: ${inv.description} | Valor: R$ ${(inv.amount_cents / 100).toFixed(2)} | Vencimento: ${inv.due_date} | Status: ${inv.status}`
    ).join("\n");

    const systemPrompt = `Você é um assistente financeiro especializado em analisar comprovantes de pagamento.
Sua tarefa é analisar a imagem do comprovante enviado e comparar com as faturas em aberto do cliente "${company_name || "desconhecido"}".

Faturas em aberto:
${invoiceList}

Analise a imagem e retorne APENAS um JSON com o seguinte formato (sem markdown, sem code blocks):
{
  "found_payment": true/false,
  "amount_found": valor em reais encontrado no comprovante (número),
  "date_found": "data encontrada no comprovante (YYYY-MM-DD ou null)",
  "matched_invoice_id": "ID da fatura correspondente ou null",
  "confidence": "high/medium/low",
  "summary": "Resumo breve da análise em português"
}

Regras:
- Compare o valor do comprovante com os valores das faturas (considere tolerância de R$ 0,50)
- Se o valor bater com uma fatura, retorne o ID dela em matched_invoice_id
- Se houver mais de uma fatura com valor similar, escolha a com vencimento mais próximo
- Se não conseguir ler a imagem ou não encontrar informações, retorne found_payment: false
- Sempre responda em português`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analise este comprovante de pagamento e compare com as faturas listadas.",
              },
              {
                type: "image_url",
                image_url: { url: media_url },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido, tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes para análise de IA." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    // Parse the JSON response from AI
    let analysis;
    try {
      // Try to extract JSON from the response (handle cases where AI wraps in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in AI response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      analysis = {
        found_payment: false,
        amount_found: null,
        date_found: null,
        matched_invoice_id: null,
        confidence: "low",
        summary: "Não foi possível analisar o comprovante automaticamente. Por favor, verifique manualmente.",
      };
    }

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Analyze receipt error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao analisar comprovante" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
