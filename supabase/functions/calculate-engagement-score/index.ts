import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EngagementMetrics {
  meetingScore: number;
  taskScore: number;
  responseScore: number;
  retentionScore: number;
  npsScore: number;
  totalScore: number;
  breakdown: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { staffId, calculateAll, periodDays = 30 } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);

    let staffIds: string[] = [];

    if (calculateAll) {
      // Only calculate for consultants and CS roles
      const { data: allStaff } = await supabase
        .from('onboarding_staff')
        .select('id')
        .eq('is_active', true)
        .in('role', ['cs', 'consultant']);

      staffIds = allStaff?.map((s: { id: string }) => s.id) || [];
    } else if (staffId) {
      staffIds = [staffId];
    } else {
      return new Response(
        JSON.stringify({ error: 'staffId or calculateAll is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: unknown[] = [];
    const staffWithProjects: string[] = [];

    for (const sid of staffIds) {
      // Check if staff has any projects assigned (as consultant or CS)
      const { count: projectCount } = await supabase
        .from('onboarding_projects')
        .select('id', { count: 'exact' })
        .or(`consultant_id.eq.${sid},cs_id.eq.${sid}`);

      if (!projectCount || projectCount === 0) {
        // Staff has no projects - delete any existing score and skip
        await supabase
          .from('consultant_engagement_scores')
          .delete()
          .eq('staff_id', sid);
        console.log(`Skipping staff ${sid} - no projects assigned`);
        continue;
      }

      staffWithProjects.push(sid);
      const metrics = await calculateMetricsForStaff(supabase, sid, periodStart, periodEnd);
      
      const { data: scoreData, error: upsertError } = await supabase
        .from('consultant_engagement_scores')
        .upsert({
          staff_id: sid,
          calculation_date: new Date().toISOString().split('T')[0],
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          meeting_score: metrics.meetingScore,
          task_score: metrics.taskScore,
          response_score: metrics.responseScore,
          retention_score: metrics.retentionScore,
          nps_score: metrics.npsScore,
          total_score: metrics.totalScore,
          metrics_breakdown: metrics.breakdown,
        }, {
          onConflict: 'staff_id,calculation_date',
        })
        .select('*, onboarding_staff(name)')
        .single();

      if (!upsertError && scoreData) {
        results.push(scoreData);
      }
    }

    // Calculate rankings
    const sortedResults = [...results].sort((a: unknown, b: unknown) => {
      const aScore = (a as { total_score: number }).total_score;
      const bScore = (b as { total_score: number }).total_score;
      return bScore - aScore;
    });
    
    for (let i = 0; i < sortedResults.length; i++) {
      const result = sortedResults[i] as { id: string; rank_position?: number };
      await supabase
        .from('consultant_engagement_scores')
        .update({ rank_position: i + 1 })
        .eq('id', result.id);
      result.rank_position = i + 1;
    }

    console.log(`Calculated engagement scores for ${results.length} consultants`);

    return new Response(
      JSON.stringify({ scores: sortedResults, calculated_at: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in calculate-engagement-score:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function calculateMetricsForStaff(
  supabase: any,
  staffId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<EngagementMetrics> {
  const breakdown: Record<string, unknown> = {};

  // 1. Projects handled by this staff member
  // Consultants are linked via consultant_id, CS via cs_id.
  // We include both so the same scoring function works for both roles.
  const { data: projects } = await supabase
    .from('onboarding_projects')
    .select('id')
    .eq('status', 'active')
    .or(`consultant_id.eq.${staffId},cs_id.eq.${staffId}`);

  const projectIds = projects?.map((p: { id: string }) => p.id) || [];
  // 1. Meeting Score (20%) - finalized meetings by this staff member
  let meetingScore = 0;
  
  // Count meetings finalized by this staff (staff_id = who finalized the meeting)
  // Also consider meetings on this staff's calendar (calendar_owner_id)
  const { count: meetingCount } = await supabase
    .from('onboarding_meeting_notes')
    .select('id', { count: 'exact' })
    .eq('is_finalized', true)
    .or(`staff_id.eq.${staffId},calendar_owner_id.eq.${staffId}`)
    .gte('meeting_date', periodStart.toISOString())
    .lte('meeting_date', periodEnd.toISOString());

  // Expect at least 2 meetings per project per month
  const expectedMeetings = Math.max(projectIds.length * 2, 4); // minimum 4 meetings expected
  const actualMeetings = meetingCount || 0;
  meetingScore = Math.min(100, (actualMeetings / Math.max(expectedMeetings, 1)) * 100);
  breakdown.meetings = { expected: expectedMeetings, actual: actualMeetings };

  // 2. Task Score (25%) - completion rate
  let taskScore = 0;
  if (projectIds.length > 0) {
    const { data: tasks } = await supabase
      .from('onboarding_tasks')
      .select('id, status, due_date, completed_at')
      .in('project_id', projectIds)
      .gte('created_at', periodStart.toISOString());

    interface Task {
      id: string;
      status: string;
      due_date: string | null;
      completed_at: string | null;
    }

    const taskList = (tasks || []) as Task[];
    const totalTasks = taskList.length;
    const completedTasks = taskList.filter((t) => t.status === 'completed').length;
    const onTimeTasks = taskList.filter((t) => 
      t.status === 'completed' && 
      t.completed_at && 
      t.due_date && 
      new Date(t.completed_at) <= new Date(t.due_date)
    ).length;

    if (totalTasks > 0) {
      const completionRate = (completedTasks / totalTasks) * 60;
      const onTimeRate = (onTimeTasks / Math.max(completedTasks, 1)) * 40;
      taskScore = completionRate + onTimeRate;
    }
    breakdown.tasks = { total: totalTasks, completed: completedTasks, onTime: onTimeTasks };
  }

  // 3. Response Score (15%) - ticket response time
  let responseScore = 100;
  if (projectIds.length > 0) {
    const { data: tickets } = await supabase
      .from('support_tickets')
      .select('id, created_at, first_response_at, status')
      .in('project_id', projectIds)
      .gte('created_at', periodStart.toISOString());

    interface Ticket {
      id: string;
      created_at: string;
      first_response_at: string | null;
      status: string;
    }

    const ticketList = (tickets || []) as Ticket[];
    const ticketsWithResponse = ticketList.filter((t) => t.first_response_at);
    
    if (ticketsWithResponse.length > 0) {
      const avgResponseHours = ticketsWithResponse.reduce((acc: number, t) => {
        const created = new Date(t.created_at);
        const responded = new Date(t.first_response_at!);
        return acc + (responded.getTime() - created.getTime()) / (1000 * 60 * 60);
      }, 0) / ticketsWithResponse.length;

      // Score: <4h = 100, <8h = 80, <24h = 60, <48h = 40, else = 20
      if (avgResponseHours < 4) responseScore = 100;
      else if (avgResponseHours < 8) responseScore = 80;
      else if (avgResponseHours < 24) responseScore = 60;
      else if (avgResponseHours < 48) responseScore = 40;
      else responseScore = 20;

      breakdown.tickets = { count: ticketsWithResponse.length, avgResponseHours: Math.round(avgResponseHours * 10) / 10 };
    }
  }

  // 4. Retention Score (25%) - client retention
  // For consultants: projects where consultant_id = staffId
  // For CS: projects where cs_id = staffId
  let retentionScore = 100;

  const { count: activeCount } = await supabase
    .from('onboarding_projects')
    .select('id', { count: 'exact' })
    .eq('status', 'active')
    .or(`consultant_id.eq.${staffId},cs_id.eq.${staffId}`);

  const { count: churnedCount } = await supabase
    .from('onboarding_projects')
    .select('id', { count: 'exact' })
    .eq('status', 'closed')
    .or(`consultant_id.eq.${staffId},cs_id.eq.${staffId}`)
    .gte('churned_at', periodStart.toISOString());

  const totalHandled = (activeCount || 0) + (churnedCount || 0);
  if (totalHandled > 0) {
    retentionScore = ((activeCount || 0) / totalHandled) * 100;
  }
  breakdown.retention = { active: activeCount || 0, churned: churnedCount || 0 };
  // 5. NPS Score (15%) - average NPS from clients
  let npsScore = 50; // default neutral
  if (projectIds.length > 0) {
    const { data: npsResponses } = await supabase
      .from('nps_responses')
      .select('score')
      .in('project_id', projectIds)
      .gte('created_at', periodStart.toISOString());

    interface NpsResponse {
      score: number;
    }

    const npsList = (npsResponses || []) as NpsResponse[];
    if (npsList.length > 0) {
      const avgNps = npsList.reduce((acc: number, r) => acc + r.score, 0) / npsList.length;
      // Convert NPS (0-10) to score (0-100)
      npsScore = avgNps * 10;
      breakdown.nps = { responses: npsList.length, average: Math.round(avgNps * 10) / 10 };
    }
  }

  // Calculate weighted total score
  const totalScore = 
    (meetingScore * 0.20) +
    (taskScore * 0.25) +
    (responseScore * 0.15) +
    (retentionScore * 0.25) +
    (npsScore * 0.15);

  return {
    meetingScore: Math.round(meetingScore * 100) / 100,
    taskScore: Math.round(taskScore * 100) / 100,
    responseScore: Math.round(responseScore * 100) / 100,
    retentionScore: Math.round(retentionScore * 100) / 100,
    npsScore: Math.round(npsScore * 100) / 100,
    totalScore: Math.round(totalScore * 100) / 100,
    breakdown,
  };
}
