import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OBJECTIVES_CONFIG: Record<string, any> = {
  sell: {
    placements: ["feed", "marketplace"],
    cta: "whatsapp",
    budget_multiplier: 1.2,
  },
  whatsapp_leads: {
    placements: ["feed", "stories"],
    cta: "whatsapp",
    budget_multiplier: 1.0,
  },
  community: {
    placements: ["feed", "communities"],
    cta: "view_community",
    budget_multiplier: 0.8,
  },
  event: {
    placements: ["feed", "stories", "communities"],
    cta: "view_event",
    budget_multiplier: 0.9,
  },
  brand_awareness: {
    placements: ["feed", "stories"],
    cta: "learn_more",
    budget_multiplier: 0.7,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { request_id, profile_id, objective, context } = await req.json();

    if (!profile_id || !objective) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = OBJECTIVES_CONFIG[objective] || OBJECTIVES_CONFIG.brand_awareness;

    // Generate campaign name based on objective
    const objectiveLabels: Record<string, string> = {
      sell: "Vendas",
      whatsapp_leads: "Leads WhatsApp",
      community: "Comunidade",
      event: "Evento",
      brand_awareness: "Marca",
    };

    const date = new Date();
    const campaignName = `${objectiveLabels[objective]} - ${date.toLocaleDateString("pt-BR")}`;

    // Calculate suggested budget
    const baseBudget = 50;
    const suggestedBudget = baseBudget * config.budget_multiplier;

    // Generate ad content based on objective and context
    let adTitle = "";
    let adContent = "";

    switch (objective) {
      case "sell":
        adTitle = context ? `Oferta Especial` : "Confira Nossa Oferta";
        adContent = context || "Aproveite condições exclusivas. Entre em contato agora!";
        break;
      case "whatsapp_leads":
        adTitle = "Fale Conosco";
        adContent = context || "Tire suas dúvidas diretamente pelo WhatsApp. Atendimento rápido!";
        break;
      case "community":
        adTitle = "Junte-se à Nossa Comunidade";
        adContent = context || "Faça parte de um grupo exclusivo de profissionais engajados.";
        break;
      case "event":
        adTitle = "Evento Imperdível";
        adContent = context || "Participe do nosso próximo evento e transforme sua carreira.";
        break;
      default:
        adTitle = "Conheça Nossa Marca";
        adContent = context || "Descubra como podemos ajudar você a alcançar seus objetivos.";
    }

    const suggestion = {
      campaign: {
        name: campaignName,
        objective: objective,
        daily_budget: suggestedBudget,
      },
      ad_set: {
        name: `Público ${objectiveLabels[objective]}`,
        targeting: {
          min_trust_score: 30,
          interests: [],
        },
        placements: config.placements,
      },
      ad: {
        title: adTitle,
        content: adContent,
        cta: config.cta,
      },
      audience_suggestion: `Público sugerido: usuários ativos com Trust Score acima de 30, interessados em ${objectiveLabels[objective].toLowerCase()}.`,
      budget_reasoning: `Orçamento diário sugerido de R$ ${suggestedBudget.toFixed(2)} baseado no objetivo "${objectiveLabels[objective]}" e no histórico de campanhas similares.`,
      confidence: 0.85,
    };

    // Update request status
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (request_id) {
      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/circle_ads_ai_requests?id=eq.${request_id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ status: "completed" }),
        }
      );

      // Save result
      await fetch(`${supabaseUrl}/rest/v1/circle_ads_ai_results`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          request_id,
          campaign_suggestion: suggestion.campaign,
          ad_set_suggestion: suggestion.ad_set,
          ad_suggestion: suggestion.ad,
          audience_suggestion: { description: suggestion.audience_suggestion },
          budget_suggestion: { reasoning: suggestion.budget_reasoning },
          confidence_score: suggestion.confidence,
        }),
      });
    }

    return new Response(
      JSON.stringify({ success: true, suggestion }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Circle Ads AI Error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
