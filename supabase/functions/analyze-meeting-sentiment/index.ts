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
    const { meetingId, projectId } = await req.json();

    if (!meetingId) {
      return new Response(
        JSON.stringify({ error: 'meetingId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch meeting data
    const { data: meeting, error: meetingError } = await supabase
      .from('onboarding_meeting_notes')
      .select('id, project_id, notes, transcript, manual_transcript, meeting_date, meeting_type')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      console.error('Meeting fetch error:', meetingError);
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get transcription content
    const transcriptionContent = meeting.transcript || meeting.manual_transcript || meeting.notes;

    if (!transcriptionContent || transcriptionContent.length < 50) {
      return new Response(
        JSON.stringify({ error: 'Insufficient transcription content for analysis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get project context
    const { data: project } = await supabase
      .from('onboarding_projects')
      .select('id, onboarding_companies(name)')
      .eq('id', meeting.project_id)
      .single();

    const company = project?.onboarding_companies as unknown as { name: string } | null;
    const companyName = company?.name || 'Cliente';

    // AI prompt for sentiment analysis
    const systemPrompt = `Você é um especialista em análise de sentimento e comunicação empresarial. 
Analise a transcrição da reunião e extraia informações sobre o tom emocional, satisfação do cliente e pontos de atenção.

Responda APENAS com um JSON válido no seguinte formato:
{
  "overall_sentiment": "positive" | "neutral" | "negative" | "mixed",
  "sentiment_score": número entre -1.0 e 1.0 (negativo = insatisfeito, positivo = satisfeito),
  "key_emotions": {
    "satisfaction": 0-1,
    "frustration": 0-1,
    "enthusiasm": 0-1,
    "concern": 0-1,
    "confidence": 0-1
  },
  "concern_keywords": ["lista de palavras/frases que indicam preocupação ou insatisfação"],
  "positive_keywords": ["lista de palavras/frases positivas detectadas"],
  "summary": "Resumo em 2-3 frases do sentimento geral da reunião",
  "ai_insights": "Insights e recomendações baseados na análise de sentimento (2-4 frases)"
}`;

    const userPrompt = `Analise o sentimento da seguinte transcrição de reunião com ${companyName}:

---
${transcriptionContent.substring(0, 8000)}
---

Retorne APENAS o JSON com a análise de sentimento.`;

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('Empty AI response');
    }

    // Parse AI response
    let analysis;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Content:', aiContent);
      throw new Error('Failed to parse AI response');
    }

    // Save to database
    const { data: sentimentData, error: insertError } = await supabase
      .from('meeting_sentiment_analysis')
      .upsert({
        meeting_id: meetingId,
        project_id: meeting.project_id,
        overall_sentiment: analysis.overall_sentiment,
        sentiment_score: analysis.sentiment_score,
        key_emotions: analysis.key_emotions,
        concern_keywords: analysis.concern_keywords || [],
        positive_keywords: analysis.positive_keywords || [],
        summary: analysis.summary,
        ai_insights: analysis.ai_insights,
      }, {
        onConflict: 'meeting_id',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error('Failed to save sentiment analysis');
    }

    console.log('Sentiment analysis completed for meeting:', meetingId);

    return new Response(
      JSON.stringify(sentimentData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-meeting-sentiment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
