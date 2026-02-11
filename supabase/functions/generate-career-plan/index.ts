import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { projectId, formId } = await req.json();
    if (!projectId || !formId) {
      return new Response(JSON.stringify({ error: "projectId and formId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get form data
    const { data: form, error: formError } = await supabase
      .from("career_plan_forms")
      .select("*")
      .eq("id", formId)
      .single();

    if (formError || !form) {
      return new Response(JSON.stringify({ error: "Form not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build prompt
    const prompt = `Você é um especialista em RH e estruturação de planos de carreira.
Com base nas informações abaixo, gere um plano de carreira completo e detalhado para esta empresa.

INFORMAÇÕES DA EMPRESA:
- Segmento: ${form.company_segment || "Não informado"}
- Colaboradores: ${form.employee_count || "Não informado"}
- Estrutura atual: ${form.current_role_structure || "Não informado"}
- Cultura: ${form.company_culture_type || "Não informado"}
- Possui plano atual: ${form.has_career_plan ? "Sim - " + (form.current_career_plan_details || "") : "Não"}
- Preferência de crescimento: ${form.growth_preference || "Não informado"}
- Mais valoriza: ${form.values_most || "Não informado"}
- Faixas salariais: ${form.salary_ranges || "Não informado"}
- Política de aumento: ${form.raise_policy || "Não informado"}
- Benefícios: ${form.benefits_by_level || "Não informado"}
- Critérios de avaliação: ${form.current_evaluation_criteria || "Não informado"}
- Frequência avaliação: ${form.evaluation_frequency || "Não informado"}
- Usa metas: ${form.uses_goals ? "Sim" : "Não"}
- Tipos de metas: ${(form.goal_types || []).join(", ") || "Não informado"}
- Observações: ${form.additional_notes || "Nenhuma"}

GERE o plano no formato JSON abaixo (sem markdown, apenas JSON puro):
{
  "tracks": [
    {
      "name": "Nome da Trilha",
      "description": "Descrição",
      "track_type": "vertical" ou "horizontal",
      "department": "Departamento",
      "roles": [
        {
          "name": "Nome do Cargo",
          "description": "Descrição do cargo e responsabilidades",
          "level_order": 0,
          "salary_min": 2000,
          "salary_max": 3000,
          "min_time_months": 6,
          "benefits": "Benefícios do nível",
          "is_entry_level": true,
          "criteria": [
            {
              "name": "Nome do critério",
              "description": "Descrição",
              "weight": 1,
              "min_score": 7,
              "criteria_type": "performance"
            }
          ],
          "goals": [
            {
              "title": "Título da meta",
              "description": "Descrição",
              "goal_type": "quantitative",
              "target_value": "100%",
              "measurement_unit": "percentual"
            }
          ]
        }
      ]
    }
  ]
}

REGRAS:
1. Gere pelo menos 2 trilhas verticais e 1 horizontal
2. Cada trilha deve ter pelo menos 3 cargos/níveis
3. Salários devem ser realistas para o mercado brasileiro
4. Critérios claros e mensuráveis
5. Metas específicas por cargo
6. Tempo mínimo realista entre níveis
7. Se a empresa é comercial, inclua trilha de vendas
8. Se valoriza liderança, inclua trilha de gestão
9. Responda APENAS com o JSON, sem texto adicional`;

    // Call Gemini via Lovable AI proxy
    const aiResponse = await fetch("https://czmyjgdixwhpfasfugkm.supabase.co/functions/v1/proxy-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    // Fallback: direct Gemini call
    let planData;
    if (!aiResponse.ok) {
      // Try using the GEMINI_API_KEY secret
      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      if (!geminiKey) {
        return new Response(JSON.stringify({ error: "AI service unavailable" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7 },
          }),
        }
      );
      const geminiData = await geminiRes.json();
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return new Response(JSON.stringify({ error: "Failed to parse AI response" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      planData = JSON.parse(jsonMatch[0]);
    } else {
      const aiData = await aiResponse.json();
      const text = typeof aiData === "string" ? aiData : (aiData.choices?.[0]?.message?.content || aiData.content || JSON.stringify(aiData));
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return new Response(JSON.stringify({ error: "Failed to parse AI response" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      planData = JSON.parse(jsonMatch[0]);
    }

    // Create version
    const existingVersions = await supabase
      .from("career_plan_versions")
      .select("version_number")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false })
      .limit(1);

    const nextVersion = ((existingVersions.data?.[0] as any)?.version_number || 0) + 1;

    // Deactivate existing versions
    await supabase
      .from("career_plan_versions")
      .update({ is_active: false })
      .eq("project_id", projectId);

    const { data: version, error: versionError } = await supabase
      .from("career_plan_versions")
      .insert({
        project_id: projectId,
        version_number: nextVersion,
        version_name: `Plano Gerado por IA v${nextVersion}`,
        is_active: true,
        generated_by_ai: true,
      })
      .select()
      .single();

    if (versionError || !version) {
      return new Response(JSON.stringify({ error: "Failed to create version" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create tracks, roles, criteria, and goals
    for (let tIdx = 0; tIdx < (planData.tracks || []).length; tIdx++) {
      const track = planData.tracks[tIdx];
      const { data: createdTrack, error: trackError } = await supabase
        .from("career_tracks")
        .insert({
          version_id: version.id,
          name: track.name,
          description: track.description || null,
          track_type: track.track_type || "vertical",
          department: track.department || null,
          sort_order: tIdx,
        })
        .select()
        .single();

      if (trackError || !createdTrack) continue;

      for (let rIdx = 0; rIdx < (track.roles || []).length; rIdx++) {
        const role = track.roles[rIdx];
        const { data: createdRole, error: roleError } = await supabase
          .from("career_roles")
          .insert({
            track_id: createdTrack.id,
            name: role.name,
            description: role.description || null,
            level_order: role.level_order ?? rIdx,
            salary_min: role.salary_min || null,
            salary_max: role.salary_max || null,
            salary_base: role.salary_min || null,
            min_time_months: role.min_time_months || null,
            benefits: role.benefits || null,
            is_entry_level: role.is_entry_level || false,
          })
          .select()
          .single();

        if (roleError || !createdRole) continue;

        // Create criteria
        for (let cIdx = 0; cIdx < (role.criteria || []).length; cIdx++) {
          const criterion = role.criteria[cIdx];
          await supabase.from("career_criteria").insert({
            role_id: createdRole.id,
            name: criterion.name,
            description: criterion.description || null,
            weight: criterion.weight || 1,
            min_score: criterion.min_score || 7,
            criteria_type: criterion.criteria_type || "performance",
            sort_order: cIdx,
          });
        }

        // Create goals
        for (let gIdx = 0; gIdx < (role.goals || []).length; gIdx++) {
          const goal = role.goals[gIdx];
          await supabase.from("career_goals").insert({
            role_id: createdRole.id,
            title: goal.title,
            description: goal.description || null,
            goal_type: goal.goal_type || "quantitative",
            target_value: goal.target_value || null,
            measurement_unit: goal.measurement_unit || null,
            sort_order: gIdx,
          });
        }
      }
    }

    // Log
    await supabase.from("career_audit_log").insert({
      project_id: projectId,
      version_id: version.id,
      action: "ai_generation",
      action_details: { form_id: formId, tracks_count: planData.tracks?.length || 0 },
    });

    return new Response(JSON.stringify({ success: true, versionId: version.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
