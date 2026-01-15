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

    if (!meetingId || !projectId) {
      return new Response(
        JSON.stringify({ error: 'meetingId and projectId are required' }),
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

    // Get project and company data
    const { data: project } = await supabase
      .from('onboarding_projects')
      .select(`
        id,
        start_date,
        consultant_id,
        onboarding_companies(name, segment, contact_name, contact_phone, contact_email),
        onboarding_products(name),
        onboarding_staff(name)
      `)
      .eq('id', projectId)
      .single();

    if (!project) {
      return new Response(
        JSON.stringify({ error: 'Project not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get last 3 completed meetings
    const { data: pastMeetings } = await supabase
      .from('onboarding_meeting_notes')
      .select('id, meeting_date, meeting_type, notes, transcript, manual_transcript')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .neq('id', meetingId)
      .order('meeting_date', { ascending: false })
      .limit(3);

    // Get pending tasks
    const { data: pendingTasks } = await supabase
      .from('onboarding_tasks')
      .select('id, title, status, priority, due_date')
      .eq('project_id', projectId)
      .in('status', ['pending', 'in_progress'])
      .order('due_date', { ascending: true })
      .limit(10);

    // Get current month goals
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: goals } = await supabase
      .from('project_monthly_goals')
      .select('revenue_goal, revenue_actual, deals_goal, deals_actual')
      .eq('project_id', projectId)
      .eq('month_year', currentMonth)
      .single();

    // Get health score
    const { data: healthScore } = await supabase
      .from('client_health_scores')
      .select('total_score, risk_level, engagement_score, satisfaction_score, goals_score')
      .eq('project_id', projectId)
      .single();

    // Get churn prediction
    const { data: churnPrediction } = await supabase
      .from('churn_predictions')
      .select('churn_probability, risk_level, risk_factors, recommended_actions')
      .eq('project_id', projectId)
      .order('prediction_date', { ascending: false })
      .limit(1)
      .single();

    // Get open tickets
    const { data: openTickets, count: ticketCount } = await supabase
      .from('support_tickets')
      .select('id, subject, priority, status', { count: 'exact' })
      .eq('project_id', projectId)
      .in('status', ['open', 'in_progress'])
      .limit(5);

    // Get recent NPS/CSAT
    const { data: npsData } = await supabase
      .from('nps_responses')
      .select('score, feedback, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(3);

    // Build context for AI
    interface Company {
      name: string;
      segment: string;
      contact_name: string;
      contact_phone: string;
      contact_email: string;
    }
    interface Product { name: string; }
    interface Staff { name: string; }
    interface Meeting {
      id: string;
      meeting_date: string;
      meeting_type: string;
      notes: string | null;
      transcript: string | null;
      manual_transcript: string | null;
    }
    interface Task {
      id: string;
      title: string;
      status: string;
      priority: string;
      due_date: string | null;
    }
    interface Ticket {
      id: string;
      subject: string;
      priority: string;
      status: string;
    }
    interface NpsResponse {
      score: number;
      feedback: string | null;
      created_at: string;
    }

    const company = project.onboarding_companies as unknown as Company | null;
    const product = project.onboarding_products as unknown as Product | null;
    const staff = project.onboarding_staff as unknown as Staff | null;

    const companyName = company?.name || 'Cliente';
    const contactName = company?.contact_name || 'Contato';
    const segment = company?.segment || 'Não definido';
    const productName = product?.name || 'Serviço';

    const meetingList = (pastMeetings || []) as Meeting[];
    const meetingHistory = meetingList.map((m, idx) => {
      const content = m.notes || m.transcript || m.manual_transcript || 'Sem notas';
      return `Reunião ${idx + 1} (${new Date(m.meeting_date).toLocaleDateString('pt-BR')}): ${content.substring(0, 500)}...`;
    }).join('\n\n') || 'Sem histórico de reuniões anteriores';

    const taskList = (pendingTasks || []) as Task[];
    const tasksList = taskList.map((t) => 
      `- [${t.priority?.toUpperCase()}] ${t.title} (Prazo: ${t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : 'Sem prazo'})`
    ).join('\n') || 'Nenhuma tarefa pendente';

    const goalStatus = goals 
      ? `Receita: ${((goals.revenue_actual || 0) / (goals.revenue_goal || 1) * 100).toFixed(0)}% da meta | Vendas: ${goals.deals_actual || 0}/${goals.deals_goal || 0}`
      : 'Metas não definidas';

    const ticketList = (openTickets || []) as Ticket[];
    const npsList = (npsData || []) as NpsResponse[];

    const systemPrompt = `Você é um assistente de Customer Success que prepara briefings executivos para reuniões.
Seu objetivo é fornecer um resumo completo e acionável para que o consultor entre na reunião bem preparado.

Responda APENAS com um JSON válido no seguinte formato:
{
  "executive_summary": "Resumo executivo de 3-4 frases sobre a situação atual do cliente",
  "client_history": "Resumo do histórico recente (últimas reuniões, pontos discutidos)",
  "pending_items": "Lista formatada dos itens pendentes e compromissos em aberto",
  "goal_status": "Status das metas e performance do cliente",
  "attention_points": "Pontos de atenção críticos que precisam ser abordados",
  "suggested_agenda": "Pauta sugerida para a reunião (3-5 itens)",
  "talking_points": ["Lista de 3-5 pontos importantes para abordar na reunião"]
}`;

    const userPrompt = `Prepare um briefing para a próxima reunião com o cliente:

**Cliente:** ${companyName}
**Contato Principal:** ${contactName}
**Segmento:** ${segment}
**Produto:** ${productName}
**Consultor:** ${staff?.name || 'Não definido'}

**Health Score:** ${healthScore?.total_score?.toFixed(0) || 'N/A'} (Risco: ${healthScore?.risk_level || 'N/A'})
**Risco de Churn:** ${churnPrediction ? `${(churnPrediction.churn_probability * 100).toFixed(0)}% (${churnPrediction.risk_level})` : 'Não calculado'}

**Histórico de Reuniões:**
${meetingHistory}

**Tarefas Pendentes:**
${tasksList}

**Status das Metas:** ${goalStatus}

**Tickets Abertos:** ${ticketCount || 0} tickets
${ticketList.map((t) => `- [${t.priority}] ${t.subject}`).join('\n') || ''}

**Últimas Avaliações NPS:**
${npsList.map((n) => `- Score: ${n.score} | ${n.feedback || 'Sem comentário'}`).join('\n') || 'Sem avaliações recentes'}

**Fatores de Risco (se houver):**
${churnPrediction?.risk_factors ? JSON.stringify(churnPrediction.risk_factors) : 'Nenhum identificado'}

Gere um briefing completo e acionável para esta reunião.`;

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
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('Empty AI response');
    }

    // Parse AI response
    interface BriefingResponse {
      executive_summary: string;
      client_history: string;
      pending_items: string;
      goal_status: string;
      attention_points: string;
      suggested_agenda: string;
      talking_points: string[];
    }

    let briefing: BriefingResponse;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        briefing = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Content:', aiContent);
      throw new Error('Failed to parse AI response');
    }

    // Save briefing to database
    const { data: briefingData, error: insertError } = await supabase
      .from('meeting_briefings')
      .upsert({
        meeting_id: meetingId,
        project_id: projectId,
        executive_summary: briefing.executive_summary,
        client_history: briefing.client_history,
        pending_items: briefing.pending_items,
        goal_status: briefing.goal_status,
        attention_points: briefing.attention_points,
        suggested_agenda: briefing.suggested_agenda,
        talking_points: briefing.talking_points || [],
        health_score_at_generation: healthScore?.total_score,
        churn_risk_at_generation: churnPrediction?.risk_level,
      }, {
        onConflict: 'meeting_id',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error('Failed to save meeting briefing');
    }

    console.log('Meeting briefing prepared for meeting:', meetingId);

    return new Response(
      JSON.stringify(briefingData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in prepare-meeting-briefing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
