import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um especialista em Recursos Humanos e Desenvolvimento Organizacional, especializado em análise de avaliações DISC, 360° e Clima Organizacional.

Sua tarefa é criar um relatório executivo completo e profissional que será enviado ao cliente. O relatório deve ser estruturado, objetivo e com recomendações práticas.

ESTRUTURA DO RELATÓRIO:

## 📊 Resumo Executivo
Um parágrafo resumindo os principais achados das avaliações.

## 🧠 Análise DISC
- Distribuição dos perfis identificados
- Perfis predominantes na equipe
- Complementaridade entre os perfis
- Recomendações de comunicação e gestão para cada perfil

## 🎯 Avaliação 360°
- Competências mais fortes da equipe
- Áreas que precisam de desenvolvimento
- Padrões identificados nos feedbacks
- Pontos de atenção específicos

## 🌡️ Clima Organizacional
- Nível geral de satisfação
- Pontos positivos destacados pelos colaboradores
- Áreas de melhoria identificadas
- Riscos de retenção

## 💡 Recomendações
Lista de ações prioritárias com base nas análises:
1. Ações de curto prazo (próximos 30 dias)
2. Ações de médio prazo (próximos 90 dias)
3. Ações de longo prazo (próximos 6-12 meses)

## 📈 Conclusão
Síntese final com visão otimista e construtiva para o desenvolvimento da equipe.

IMPORTANTE:
- Seja específico e cite dados quando possível
- Use linguagem profissional mas acessível
- Foque em insights acionáveis
- Mantenha tom positivo e construtivo
- Se alguma área não tiver dados, mencione que não há dados suficientes para análise`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cycleId, cycleTitle, projectId } = await req.json();

    if (!cycleId) {
      throw new Error("cycleId é obrigatório");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all assessment data
    const [participantsRes, discRes, eval360Res, climateRes] = await Promise.all([
      supabase
        .from("assessment_participants")
        .select("id, name, role, department")
        .eq("cycle_id", cycleId),
      supabase
        .from("disc_responses")
        .select("*")
        .eq("cycle_id", cycleId),
      supabase
        .from("assessment_360_evaluations")
        .select("*")
        .eq("cycle_id", cycleId)
        .eq("is_completed", true),
      supabase
        .from("climate_survey_responses")
        .select("*")
        .eq("cycle_id", cycleId),
    ]);

    // Fetch project info separately
    let projectName = cycleTitle;
    let companyName = "";
    
    if (projectId) {
      const { data: projectData } = await supabase
        .from("onboarding_projects")
        .select("name")
        .eq("id", projectId)
        .single();
      
      if (projectData) {
        projectName = projectData.name || cycleTitle;
      }

      // Fetch company separately to avoid type issues
      const { data: companyData } = await supabase
        .from("onboarding_projects")
        .select("company_id")
        .eq("id", projectId)
        .single();
      
      if (companyData?.company_id) {
        const { data: company } = await supabase
          .from("onboarding_companies")
          .select("name")
          .eq("id", companyData.company_id)
          .single();
        
        if (company) {
          companyName = company.name || "";
        }
      }
    }

    const participants = participantsRes.data || [];
    const discResponses = discRes.data || [];
    const evaluations360 = eval360Res.data || [];
    const climateResponses = climateRes.data || [];

    // Build context for AI
    let contextPrompt = `DADOS DO RELATÓRIO DE AVALIAÇÕES\n\n`;
    contextPrompt += `Ciclo: ${cycleTitle}\n`;
    if (companyName) contextPrompt += `Empresa: ${companyName}\n`;
    if (projectName) contextPrompt += `Projeto: ${projectName}\n`;
    contextPrompt += `Total de Participantes: ${participants.length}\n\n`;

    // DISC Analysis
    contextPrompt += `## DADOS DISC (${discResponses.length} respostas)\n`;
    if (discResponses.length > 0) {
      const discProfiles: Record<string, number> = {};
      discResponses.forEach((r: any) => {
        if (r.primary_profile) {
          discProfiles[r.primary_profile] = (discProfiles[r.primary_profile] || 0) + 1;
        }
      });
      
      const profileNames: Record<string, string> = {
        D: "Dominância",
        I: "Influência",
        S: "Estabilidade",
        C: "Conformidade"
      };

      contextPrompt += `Distribuição de perfis:\n`;
      Object.entries(discProfiles).forEach(([profile, count]) => {
        const percentage = ((count / discResponses.length) * 100).toFixed(1);
        contextPrompt += `- ${profileNames[profile] || profile}: ${count} pessoas (${percentage}%)\n`;
      });

      contextPrompt += `\nDetalhes individuais:\n`;
      discResponses.forEach((r: any) => {
        contextPrompt += `- ${r.respondent_name}: Perfil ${r.primary_profile}${r.secondary_profile ? `/${r.secondary_profile}` : ""} (D:${r.dominance_score}, I:${r.influence_score}, S:${r.steadiness_score}, C:${r.conscientiousness_score})\n`;
      });
    } else {
      contextPrompt += "Nenhuma avaliação DISC realizada.\n";
    }

    // 360° Analysis
    contextPrompt += `\n## DADOS 360° (${evaluations360.length} avaliações)\n`;
    if (evaluations360.length > 0) {
      // Calculate averages
      const totals = {
        leadership: { sum: 0, count: 0 },
        communication: { sum: 0, count: 0 },
        teamwork: { sum: 0, count: 0 },
        conflict: { sum: 0, count: 0 },
        proactivity: { sum: 0, count: 0 },
        results: { sum: 0, count: 0 },
      };

      evaluations360.forEach((e: any) => {
        if (e.leadership_score) { totals.leadership.sum += e.leadership_score; totals.leadership.count++; }
        if (e.communication_score) { totals.communication.sum += e.communication_score; totals.communication.count++; }
        if (e.teamwork_score) { totals.teamwork.sum += e.teamwork_score; totals.teamwork.count++; }
        if (e.conflict_management_score) { totals.conflict.sum += e.conflict_management_score; totals.conflict.count++; }
        if (e.proactivity_score) { totals.proactivity.sum += e.proactivity_score; totals.proactivity.count++; }
        if (e.results_delivery_score) { totals.results.sum += e.results_delivery_score; totals.results.count++; }
      });

      contextPrompt += `Médias por competência (escala 1-5):\n`;
      contextPrompt += `- Liderança: ${totals.leadership.count ? (totals.leadership.sum / totals.leadership.count).toFixed(2) : "N/A"}\n`;
      contextPrompt += `- Comunicação: ${totals.communication.count ? (totals.communication.sum / totals.communication.count).toFixed(2) : "N/A"}\n`;
      contextPrompt += `- Trabalho em Equipe: ${totals.teamwork.count ? (totals.teamwork.sum / totals.teamwork.count).toFixed(2) : "N/A"}\n`;
      contextPrompt += `- Gestão de Conflitos: ${totals.conflict.count ? (totals.conflict.sum / totals.conflict.count).toFixed(2) : "N/A"}\n`;
      contextPrompt += `- Proatividade: ${totals.proactivity.count ? (totals.proactivity.sum / totals.proactivity.count).toFixed(2) : "N/A"}\n`;
      contextPrompt += `- Entrega de Resultados: ${totals.results.count ? (totals.results.sum / totals.results.count).toFixed(2) : "N/A"}\n`;

      // Collect qualitative feedback
      const strengths = evaluations360.filter((e: any) => e.strengths).map((e: any) => e.strengths);
      const improvements = evaluations360.filter((e: any) => e.improvements).map((e: any) => e.improvements);
      const comments = evaluations360.filter((e: any) => e.additional_comments).map((e: any) => e.additional_comments);

      if (strengths.length > 0) {
        contextPrompt += `\nPontos Fortes mencionados:\n`;
        strengths.slice(0, 10).forEach((s: string) => {
          contextPrompt += `- "${s}"\n`;
        });
      }

      if (improvements.length > 0) {
        contextPrompt += `\nÁreas de Melhoria mencionadas:\n`;
        improvements.slice(0, 10).forEach((i: string) => {
          contextPrompt += `- "${i}"\n`;
        });
      }

      if (comments.length > 0) {
        contextPrompt += `\nComentários Adicionais:\n`;
        comments.slice(0, 5).forEach((c: string) => {
          contextPrompt += `- "${c}"\n`;
        });
      }
    } else {
      contextPrompt += "Nenhuma avaliação 360° realizada.\n";
    }

    // Climate Analysis
    contextPrompt += `\n## DADOS DE CLIMA (${climateResponses.length} respostas)\n`;
    if (climateResponses.length > 0) {
      // Calculate climate averages
      let totalScore = 0;
      let scoreCount = 0;

      climateResponses.forEach((r: any) => {
        const scaleFields = [
          r.company_satisfaction,
          r.organizational_culture,
          r.communication_with_superiors,
          r.superior_interest_development,
          r.feels_supported,
          r.training_rating,
          r.rewards_rating,
          r.diversity_inclusion,
          r.enjoys_working_score,
          r.would_recommend_score,
        ];

        scaleFields.forEach((val) => {
          if (val !== null && val !== undefined) {
            totalScore += val;
            scoreCount++;
          }
        });
      });

      const avgClimate = scoreCount > 0 ? (totalScore / scoreCount).toFixed(2) : "N/A";
      contextPrompt += `Nota média de clima: ${avgClimate}/5\n`;

      // Collect qualitative feedback
      const whatWell = climateResponses.filter((r: any) => r.what_company_does_well).map((r: any) => r.what_company_does_well);
      const shouldImprove = climateResponses.filter((r: any) => r.what_company_should_improve).map((r: any) => r.what_company_should_improve);
      const openFeedback = climateResponses.filter((r: any) => r.open_feedback).map((r: any) => r.open_feedback);

      if (whatWell.length > 0) {
        contextPrompt += `\nO que a empresa faz bem:\n`;
        whatWell.slice(0, 5).forEach((w: string) => {
          contextPrompt += `- "${w}"\n`;
        });
      }

      if (shouldImprove.length > 0) {
        contextPrompt += `\nO que a empresa deveria melhorar:\n`;
        shouldImprove.slice(0, 5).forEach((i: string) => {
          contextPrompt += `- "${i}"\n`;
        });
      }

      if (openFeedback.length > 0) {
        contextPrompt += `\nFeedbacks abertos:\n`;
        openFeedback.slice(0, 5).forEach((f: string) => {
          contextPrompt += `- "${f}"\n`;
        });
      }
    } else {
      contextPrompt += "Nenhuma pesquisa de clima realizada.\n";
    }

    console.log("Sending to AI Gateway...");

    // Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contextPrompt },
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Por favor, adicione créditos à sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    // Return streaming response
    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error: any) {
    console.error("Error in assessment-ai-report:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao gerar relatório" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
