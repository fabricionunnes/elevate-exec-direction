import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Brazilian holidays (2024-2028)
const BRAZILIAN_HOLIDAYS: Record<number, string[]> = {
  2024: ["2024-01-01","2024-02-12","2024-02-13","2024-03-29","2024-04-21","2024-05-01","2024-05-30","2024-09-07","2024-10-12","2024-11-02","2024-11-15","2024-11-20","2024-12-25"],
  2025: ["2025-01-01","2025-03-03","2025-03-04","2025-04-18","2025-04-21","2025-05-01","2025-06-19","2025-09-07","2025-10-12","2025-11-02","2025-11-15","2025-11-20","2025-12-25"],
  2026: ["2026-01-01","2026-02-16","2026-02-17","2026-04-03","2026-04-21","2026-05-01","2026-06-04","2026-09-07","2026-10-12","2026-11-02","2026-11-15","2026-11-20","2026-12-25"],
  2027: ["2027-01-01","2027-02-08","2027-02-09","2027-03-26","2027-04-21","2027-05-01","2027-05-27","2027-09-07","2027-10-12","2027-11-02","2027-11-15","2027-11-20","2027-12-25"],
  2028: ["2028-01-01","2028-02-28","2028-02-29","2028-04-14","2028-04-21","2028-05-01","2028-06-15","2028-09-07","2028-10-12","2028-11-02","2028-11-15","2028-11-20","2028-12-25"],
};

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const dateStr = date.toISOString().split("T")[0];
  const holidays = BRAZILIAN_HOLIDAYS[year] || [];
  return holidays.includes(dateStr);
}

function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date);
}

function ensureBusinessDay(date: Date): Date {
  const result = new Date(date);
  while (!isBusinessDay(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

function addBusinessDays(startDate: Date, days: number): Date {
  let currentDate = new Date(startDate);
  let addedDays = 0;
  while (addedDays < days) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (isBusinessDay(currentDate)) {
      addedDays++;
    }
  }
  return currentDate;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, churnPredictionId } = await req.json();

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'projectId is required' }),
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

    // Check for existing active playbook
    const { data: existingPlaybook } = await supabase
      .from('rescue_playbooks')
      .select('id')
      .eq('project_id', projectId)
      .in('status', ['pending', 'in_progress'])
      .single();

    if (existingPlaybook) {
      return new Response(
        JSON.stringify({ error: 'Active playbook already exists for this project', playbook_id: existingPlaybook.id }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get churn prediction data
    let churnData;
    if (churnPredictionId) {
      const { data } = await supabase
        .from('churn_predictions')
        .select('*')
        .eq('id', churnPredictionId)
        .single();
      churnData = data;
    } else {
      const { data } = await supabase
        .from('churn_predictions')
        .select('*')
        .eq('project_id', projectId)
        .order('prediction_date', { ascending: false })
        .limit(1)
        .single();
      churnData = data;
    }

    if (!churnData) {
      return new Response(
        JSON.stringify({ error: 'No churn prediction found for this project' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get project and company data
    const { data: project } = await supabase
      .from('onboarding_projects')
      .select(`
        id,
        consultant_id,
        onboarding_companies(name, segment),
        onboarding_products(name)
      `)
      .eq('id', projectId)
      .single();

    if (!project) {
      return new Response(
        JSON.stringify({ error: 'Project not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get health score
    const { data: healthScore } = await supabase
      .from('client_health_scores')
      .select('total_score, risk_level')
      .eq('project_id', projectId)
      .single();

    // Get pending tasks count
    const { count: pendingTasks } = await supabase
      .from('onboarding_tasks')
      .select('id', { count: 'exact' })
      .eq('project_id', projectId)
      .in('status', ['pending', 'in_progress']);

    // Get recent meetings
    const { data: recentMeetings } = await supabase
      .from('onboarding_meeting_notes')
      .select('id, meeting_date, status')
      .eq('project_id', projectId)
      .order('meeting_date', { ascending: false })
      .limit(3);

    // Build context for AI
    const riskFactors = churnData.risk_factors || [];
    const company = project.onboarding_companies as unknown as { name: string; segment: string } | null;
    const product = project.onboarding_products as unknown as { name: string } | null;
    
    const companyName = company?.name || 'Cliente';
    const segment = company?.segment || 'Não definido';
    const productName = product?.name || 'Serviço';

    const systemPrompt = `Você é um especialista em Customer Success e retenção de clientes.
Sua tarefa é criar um Playbook de Resgate personalizado para um cliente em risco de churn.

Regras:
1. Analise os fatores de risco identificados
2. Crie uma estratégia de resgate clara e objetiva
3. Sugira tarefas específicas e acionáveis
4. Priorize ações de alto impacto

Responda APENAS com um JSON válido no seguinte formato:
{
  "strategy_summary": "Resumo da estratégia de resgate em 2-3 frases",
  "ai_recommendations": "Recomendações detalhadas da IA (3-5 parágrafos)",
  "tasks": [
    {
      "title": "Título da tarefa",
      "description": "Descrição detalhada",
      "priority": "urgent" | "high" | "medium",
      "due_days": número de dias para conclusão (1-14),
      "category": "meeting" | "task" | "communication" | "analysis"
    }
  ]
}`;

    const userPrompt = `Crie um Playbook de Resgate para o seguinte cliente em risco:

**Empresa:** ${companyName}
**Segmento:** ${segment}
**Produto:** ${productName}
**Probabilidade de Churn:** ${Math.round(churnData.churn_probability * 100)}%
**Nível de Risco:** ${churnData.risk_level}
**Health Score Atual:** ${healthScore?.total_score || 'N/A'}

**Fatores de Risco Identificados:**
${JSON.stringify(riskFactors, null, 2)}

**Contexto Adicional:**
- Tarefas pendentes: ${pendingTasks || 0}
- Última reunião: ${recentMeetings?.[0]?.meeting_date || 'Não encontrada'}
- Ações recomendadas pelo sistema: ${JSON.stringify(churnData.recommended_actions || [])}

Gere um playbook personalizado com tarefas específicas para reverter essa situação.`;

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
    interface PlaybookTask {
      title: string;
      description: string;
      priority: string;
      due_days: number;
      category: string;
    }

    interface PlaybookResponse {
      strategy_summary: string;
      ai_recommendations: string;
      tasks: PlaybookTask[];
    }

    let playbook: PlaybookResponse;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        playbook = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Content:', aiContent);
      throw new Error('Failed to parse AI response');
    }

    // Create playbook record
    const { data: playbookData, error: playbookError } = await supabase
      .from('rescue_playbooks')
      .insert({
        project_id: projectId,
        churn_prediction_id: churnData.id,
        status: 'in_progress',
        strategy_summary: playbook.strategy_summary,
        ai_recommendations: playbook.ai_recommendations,
        tasks_created: playbook.tasks?.length || 0,
      })
      .select()
      .single();

    if (playbookError) {
      console.error('Playbook insert error:', playbookError);
      throw new Error('Failed to create playbook');
    }

    // Create tasks from playbook - using business days to avoid weekends/holidays
    const baseDate = ensureBusinessDay(new Date());
    const tasksToCreate = (playbook.tasks || []).map((task: PlaybookTask, index: number) => {
      // Calculate due date using business days
      const dueDays = task.due_days || 7;
      const dueDate = dueDays > 0 ? addBusinessDays(baseDate, dueDays) : baseDate;

      return {
        project_id: projectId,
        title: `[RESGATE] ${task.title}`,
        description: task.description,
        status: 'pending',
        priority: task.priority || 'high',
        due_date: dueDate.toISOString().split('T')[0],
        category: task.category || 'task',
        created_by: 'system',
        metadata: {
          playbook_id: playbookData.id,
          is_rescue_task: true,
          task_order: index + 1,
        },
      };
    });

    if (tasksToCreate.length > 0) {
      const { error: tasksError } = await supabase
        .from('onboarding_tasks')
        .insert(tasksToCreate);

      if (tasksError) {
        console.error('Tasks insert error:', tasksError);
      }
    }

    console.log('Rescue playbook generated for project:', projectId, 'with', tasksToCreate.length, 'tasks');

    return new Response(
      JSON.stringify({
        playbook: playbookData,
        tasks_created: tasksToCreate.length,
        strategy: playbook,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-rescue-playbook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
