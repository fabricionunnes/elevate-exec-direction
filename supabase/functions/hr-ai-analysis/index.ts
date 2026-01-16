import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, candidateId, jobOpeningId, projectId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === 'generate_summary') {
      // Fetch candidate data
      const { data: candidate } = await supabase
        .from('candidates')
        .select(`
          *,
          job_opening:job_openings(title, description, requirements),
          candidate_disc_results(dominant_profile, d_score, i_score, s_score, c_score, interpretation),
          interviews(interview_type, score, strengths, concerns, recommendation),
          candidate_ai_evaluations(classification, compatibility_score, strengths, concerns, recommendation)
        `)
        .eq('id', candidateId)
        .single();

      if (!candidate) {
        throw new Error("Candidate not found");
      }

      // Build context for AI
      const discResult = candidate.candidate_disc_results?.[0];
      const interviews = candidate.interviews || [];
      const aiEval = candidate.candidate_ai_evaluations?.[0];

      const prompt = `
Você é um especialista em RH. Analise o perfil do candidato abaixo e gere um resumo executivo de 3-4 linhas destacando os principais pontos.

Candidato: ${candidate.full_name}
Email: ${candidate.email}
Vaga: ${candidate.job_opening?.title || 'N/A'}

${discResult ? `Perfil DISC: ${discResult.dominant_profile}
- D: ${discResult.d_score}%, I: ${discResult.i_score}%, S: ${discResult.s_score}%, C: ${discResult.c_score}%
- Interpretação: ${discResult.interpretation || 'N/A'}` : 'DISC: Não realizado'}

${interviews.length > 0 ? `Entrevistas realizadas: ${interviews.length}
- Média de score: ${(interviews.reduce((sum: number, i: any) => sum + (i.score || 0), 0) / interviews.length).toFixed(1)}
- Pontos fortes mencionados: ${interviews.map((i: any) => i.strengths).filter(Boolean).join(', ') || 'N/A'}
- Pontos de atenção: ${interviews.map((i: any) => i.concerns).filter(Boolean).join(', ') || 'N/A'}` : 'Nenhuma entrevista realizada'}

${aiEval ? `Avaliação IA anterior:
- Classificação: ${aiEval.classification}
- Score de compatibilidade: ${aiEval.compatibility_score}%
- Recomendação: ${aiEval.recommendation}` : ''}

Gere um resumo executivo conciso (máximo 4 linhas) que destaque:
1. Principal força do candidato
2. Perfil comportamental (DISC)
3. Desempenho em entrevistas (se houver)
4. Recomendação geral
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
            { role: "system", content: "Você é um especialista em RH. Responda sempre em português brasileiro de forma concisa e profissional." },
            { role: "user", content: prompt }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error("Failed to generate summary");
      }

      const data = await response.json();
      const summary = data.choices?.[0]?.message?.content || "";

      // Save summary to candidate
      await supabase
        .from('candidates')
        .update({ ai_summary: summary })
        .eq('id', candidateId);

      return new Response(JSON.stringify({ summary }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'generate_interview_questions') {
      // Fetch candidate and job data
      const { data: candidate } = await supabase
        .from('candidates')
        .select(`
          *,
          job_opening:job_openings(title, description, requirements, area),
          candidate_disc_results(dominant_profile, d_score, i_score, s_score, c_score, interpretation)
        `)
        .eq('id', candidateId)
        .single();

      if (!candidate) {
        throw new Error("Candidate not found");
      }

      const discResult = candidate.candidate_disc_results?.[0];
      const job = candidate.job_opening;

      const prompt = `
Você é um especialista em RH e entrevistas comportamentais. Gere 8 perguntas de entrevista personalizadas para o candidato abaixo.

Candidato: ${candidate.full_name}
Vaga: ${job?.title || 'Posição geral'}
Área: ${job?.area || 'N/A'}
Requisitos: ${job?.requirements || 'N/A'}

${discResult ? `Perfil DISC do candidato: ${discResult.dominant_profile}
- Dominância (D): ${discResult.d_score}%
- Influência (I): ${discResult.i_score}%
- Estabilidade (S): ${discResult.s_score}%
- Conformidade (C): ${discResult.c_score}%

Baseado no perfil DISC:
${discResult.dominant_profile === 'D' ? '- Perfil direto e orientado a resultados. Foque em desafios e conquistas.' : ''}
${discResult.dominant_profile === 'I' ? '- Perfil comunicativo e entusiasta. Foque em trabalho em equipe e relacionamentos.' : ''}
${discResult.dominant_profile === 'S' ? '- Perfil estável e colaborativo. Foque em processos e consistência.' : ''}
${discResult.dominant_profile === 'C' ? '- Perfil analítico e detalhista. Foque em qualidade e precisão.' : ''}` : 'Perfil DISC não disponível'}

Gere 8 perguntas divididas em:
- 3 perguntas comportamentais baseadas no perfil DISC
- 3 perguntas técnicas/específicas da vaga
- 2 perguntas situacionais

Formato de resposta (JSON):
{
  "behavioral": ["pergunta1", "pergunta2", "pergunta3"],
  "technical": ["pergunta1", "pergunta2", "pergunta3"],
  "situational": ["pergunta1", "pergunta2"]
}
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
            { role: "system", content: "Você é um especialista em RH e entrevistas. Responda sempre em português brasileiro e em formato JSON válido." },
            { role: "user", content: prompt }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error("Failed to generate questions");
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      
      // Try to parse JSON from response
      let questions;
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
        questions = JSON.parse(jsonMatch[1] || content);
      } catch {
        questions = {
          behavioral: [],
          technical: [],
          situational: []
        };
      }

      return new Response(JSON.stringify({ questions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'match_talent_pool') {
      // Find matching candidates in talent pool for a job
      const { data: job } = await supabase
        .from('job_openings')
        .select('*')
        .eq('id', jobOpeningId)
        .single();

      if (!job) {
        throw new Error("Job not found");
      }

      const { data: talentPool } = await supabase
        .from('candidates')
        .select(`
          id, full_name, email, ai_summary,
          candidate_disc_results(dominant_profile),
          candidate_tags(tag:talent_pool_tags(name))
        `)
        .eq('project_id', projectId)
        .eq('current_stage', 'talent_pool');

      if (!talentPool || talentPool.length === 0) {
        return new Response(JSON.stringify({ matches: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const candidatesSummary = talentPool.map(c => ({
        id: c.id,
        name: c.full_name,
        disc: c.candidate_disc_results?.[0]?.dominant_profile || 'N/A',
        tags: c.candidate_tags?.map((t: any) => t.tag?.name).filter(Boolean).join(', ') || 'N/A',
        summary: c.ai_summary || 'Sem resumo'
      }));

      const prompt = `
Você é um especialista em recrutamento. Analise os candidatos do banco de talentos e identifique os mais compatíveis com a vaga.

VAGA:
- Título: ${job.title}
- Área: ${job.area || 'N/A'}
- Requisitos: ${job.requirements || 'N/A'}
- Senioridade: ${job.seniority_level || 'N/A'}

CANDIDATOS NO BANCO DE TALENTOS:
${candidatesSummary.map((c, i) => `
${i + 1}. ${c.name}
   DISC: ${c.disc}
   Tags: ${c.tags}
   Resumo: ${c.summary}
`).join('\n')}

Analise cada candidato e retorne os 5 mais compatíveis com a vaga, ordenados por relevância.

Formato de resposta (JSON):
{
  "matches": [
    {"id": "uuid", "score": 85, "reason": "motivo da compatibilidade"}
  ]
}
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
            { role: "system", content: "Você é um especialista em recrutamento. Responda em português brasileiro e em formato JSON válido." },
            { role: "user", content: prompt }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error("Failed to match candidates");
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      
      let matches;
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
        matches = JSON.parse(jsonMatch[1] || content);
      } catch {
        matches = { matches: [] };
      }

      // Update match scores in database
      for (const match of matches.matches || []) {
        await supabase
          .from('candidates')
          .update({ ai_match_score: match.score })
          .eq('id', match.id);
      }

      return new Response(JSON.stringify(matches), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error("Invalid action");

  } catch (error: any) {
    console.error('Error in hr-ai-analysis:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
