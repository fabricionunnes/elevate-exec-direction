import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { project_id, niche, year, consultant_staff_id } = await req.json();

    if (!project_id || !niche || !year) {
      return new Response(JSON.stringify({ error: "project_id, niche and year are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if there are already actions for this project/year
    const { data: existing } = await supabase
      .from("commercial_actions")
      .select("id")
      .eq("project_id", project_id)
      .eq("year", year)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: "Já existem ações para este ano. Exclua-as primeiro para gerar novamente." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // First check if we have templates for this niche
    const { data: templates } = await supabase
      .from("commercial_action_templates")
      .select("*")
      .eq("is_active", true)
      .or(`niche.eq.${niche},niche.is.null`)
      .order("month").order("week").order("sort_order");

    let actionsToInsert: any[] = [];

    if (templates && templates.length >= 20) {
      // Use templates from bank
      actionsToInsert = templates.map(t => ({
        project_id,
        template_id: t.id,
        title: t.title,
        description: t.description,
        objective: t.objective,
        category: t.category,
        step_by_step: t.step_by_step,
        script: t.script,
        responsible_staff_id: consultant_staff_id || null,
        goal: t.default_goal,
        status: "planned",
        recurrence: t.frequency,
        month: t.month,
        week: t.week,
        year,
      }));
    } else {
      // Generate with AI
      const aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";

      const prompt = `Gere um calendário anual de ações comerciais para uma empresa do nicho "${niche}".

Gere exatamente 12 meses, com 3 a 4 ações por semana (4 semanas por mês), totalizando aproximadamente 150 ações no ano.

Para cada ação, retorne um JSON object com:
- title: título curto da ação
- description: descrição em 1-2 frases
- objective: objetivo da ação
- category: uma de [Prospecção, Conteúdo, Parcerias, Eventos, Reativação, Follow-up, Pós-venda, Autoridade, Networking]
- step_by_step: passos para executar (2-4 passos)
- script: exemplo de abordagem/mensagem se aplicável
- month: número do mês (1-12)
- week: número da semana (1-4)
- goal: meta sugerida (ex: "30 leads gerados", "10 reuniões agendadas")

Retorne APENAS um array JSON válido com as ações. Sem texto adicional.`;

      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableApiKey) throw new Error("LOVABLE_API_KEY não configurada");

      const aiResponse = await fetch(aiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 30000,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI Gateway error:", errorText);
        throw new Error("Erro ao chamar IA: " + errorText);
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || "";
      
      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("Resposta da IA não contém JSON válido");
      }

      const generatedActions = JSON.parse(jsonMatch[0]);

      actionsToInsert = generatedActions.map((a: any) => ({
        project_id,
        title: a.title,
        description: a.description || null,
        objective: a.objective || null,
        category: a.category || "Prospecção",
        step_by_step: a.step_by_step || null,
        script: a.script || null,
        responsible_staff_id: consultant_staff_id || null,
        goal: a.goal || null,
        status: "planned",
        month: a.month || null,
        week: a.week || null,
        year,
      }));
    }

    // Insert all actions
    if (actionsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("commercial_actions")
        .insert(actionsToInsert);

      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error("Erro ao salvar ações: " + insertError.message);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      count: actionsToInsert.length,
      source: (templates && templates.length >= 20) ? "templates" : "ai"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
