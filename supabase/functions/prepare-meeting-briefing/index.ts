import { createClient } from "@supabase/supabase-js";

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
    const { data: project, error: projectError } = await supabase
      .from('onboarding_projects')
      .select(`
        id,
        product_name,
        product_id,
        consultant_id,
        cs_id,
        onboarding_company_id
      `)
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('Project query error:', projectError);
      return new Response(
        JSON.stringify({ error: 'Project not found', details: projectError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get company data separately
    let company: { name: string; segment: string | null; email: string | null; phone: string | null } | null = null;
    if (project.onboarding_company_id) {
      const { data: companyData } = await supabase
        .from('onboarding_companies')
        .select('name, segment, email, phone')
        .eq('id', project.onboarding_company_id)
        .single();
      company = companyData;
    }

    // Get consultant data
    let consultant: { name: string } | null = null;
    if (project.consultant_id) {
      const { data: staffData } = await supabase
        .from('onboarding_staff')
        .select('name')
        .eq('id', project.consultant_id)
        .single();
      consultant = staffData;
    }

    // Get last 3 finalized meetings (excluding current meeting)
    const { data: pastMeetings } = await supabase
      .from('onboarding_meeting_notes')
      .select('id, meeting_date, meeting_title, notes, transcript')
      .eq('project_id', projectId)
      .eq('is_finalized', true)
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
    interface Meeting {
      id: string;
      meeting_date: string;
      meeting_title: string | null;
      notes: string | null;
      transcript: string | null;
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

    const companyName = company?.name || 'Cliente';
    const segment = company?.segment || 'Não definido';
    const productName = project.product_name || 'Serviço';
    const consultantName = consultant?.name || 'Não definido';

    const meetingList = (pastMeetings || []) as Meeting[];
    const meetingHistory = meetingList.length > 0 
      ? meetingList.map((m, idx) => {
          const title = m.meeting_title || 'Reunião';
          const content = m.transcript || m.notes || 'Sem notas/transcrição';
          // Prioritize transcript if available (more detailed)
          const contentPreview = content.length > 800 ? content.substring(0, 800) + '...' : content;
          return `**${title}** (${new Date(m.meeting_date).toLocaleDateString('pt-BR')}):\n${contentPreview}`;
        }).join('\n\n---\n\n')
      : 'Sem histórico de reuniões anteriores';

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
**Contato:** ${company?.email || company?.phone || 'Não informado'}
**Segmento:** ${segment}
**Produto:** ${productName}
**Consultor:** ${consultantName}

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
    // We store the full structured payload as JSON in a single column for flexibility.
    const { data: briefingData, error: insertError } = await supabase
      .from('onboarding_meeting_briefings')
      .upsert(
        {
          meeting_id: meetingId,
          project_id: projectId,
          briefing_content: JSON.stringify(briefing),
        },
        {
          onConflict: 'meeting_id',
        }
      )
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
