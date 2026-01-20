import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthScoreWeights {
  satisfaction_weight: number;
  goals_weight: number;
  commercial_weight: number;
  engagement_weight: number;
  support_weight: number;
  trend_weight: number;
}

const DEFAULT_WEIGHTS: HealthScoreWeights = {
  satisfaction_weight: 20,
  goals_weight: 30, // Increased weight for goals
  commercial_weight: 15,
  engagement_weight: 20, // Increased weight for engagement
  support_weight: 10,
  trend_weight: 5,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log("Starting health score calculation for all projects...");

    // Get all active projects
    const { data: projects, error: projectsError } = await supabase
      .from("onboarding_projects")
      .select("id, onboarding_company_id, status")
      .in("status", ["active", "ativo", "cancellation_requested", "cancellation_signaled", "notice_period", "sinalizou_cancelamento", "cumprindo_aviso"]);

    if (projectsError) {
      throw new Error(`Failed to fetch projects: ${projectsError.message}`);
    }

    console.log(`Found ${projects?.length || 0} projects to process`);

    const results = {
      processed: 0,
      errors: 0,
      details: [] as { projectId: string; score: number | null; error?: string }[],
    };

    for (const project of projects || []) {
      try {
        const score = await calculateProjectHealthScore(supabase, project.id, project.onboarding_company_id, project.status);
        results.processed++;
        results.details.push({ projectId: project.id, score });
        console.log(`Project ${project.id}: Score ${score}`);
      } catch (error: unknown) {
        results.errors++;
        const message = error instanceof Error ? error.message : "Unknown error";
        results.details.push({ projectId: project.id, score: null, error: message });
        console.error(`Error processing project ${project.id}:`, message);
      }
    }

    console.log(`Completed: ${results.processed} processed, ${results.errors} errors`);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in calculate-all-health-scores:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface ScoreDetails {
  goalProjection: number;
  hasGoalsConfigured: boolean;
  hasKpiEntries: boolean;
  overdueTasksCount: number;
  completedTasksRecent: number;
  meetingsCount: number;
  daysSinceLastTask: number;
  daysSinceLastMeeting: number;
  inactivityPenalty: number;
  noGoalPenalty: number;
  noKpiEntriesPenalty: number;
  overduePenalty: number;
  meetingBonus: number;
  completedTasksBonus: number;
  projectionBonus: number;
  renewalBonus: number;
  cancellationPenalty: number;
  // Client access engagement metrics
  clientAccessCount: number;
  clientAccessBonus: number;
  totalClientSessionMinutes: number;
  daysSinceLastAccess: number;
  clientActivityCount: number;
  clientActivityBonus: number;
}

async function calculateProjectHealthScore(
  supabase: any,
  projectId: string,
  companyId: string | null,
  projectStatus: string | null
): Promise<number> {
  const details: ScoreDetails = {
    goalProjection: 0,
    hasGoalsConfigured: false,
    hasKpiEntries: false,
    overdueTasksCount: 0,
    completedTasksRecent: 0,
    meetingsCount: 0,
    daysSinceLastTask: 999,
    daysSinceLastMeeting: 999,
    inactivityPenalty: 0,
    noGoalPenalty: 0,
    noKpiEntriesPenalty: 0,
    overduePenalty: 0,
    meetingBonus: 0,
    completedTasksBonus: 0,
    projectionBonus: 0,
    renewalBonus: 0,
    cancellationPenalty: 0,
    // Client access engagement metrics
    clientAccessCount: 0,
    clientAccessBonus: 0,
    totalClientSessionMinutes: 0,
    daysSinceLastAccess: 60,
    clientActivityCount: 0,
    clientActivityBonus: 0,
  };

  // Get weights for this project
  const { data: weightsData } = await supabase
    .from("health_score_weights")
    .select("*")
    .eq("project_id", projectId)
    .single();

  const weights: HealthScoreWeights = weightsData
    ? {
        satisfaction_weight: Number(weightsData.satisfaction_weight) || 20,
        goals_weight: Number(weightsData.goals_weight) || 30,
        commercial_weight: Number(weightsData.commercial_weight) || 15,
        engagement_weight: Number(weightsData.engagement_weight) || 20,
        support_weight: Number(weightsData.support_weight) || 10,
        trend_weight: Number(weightsData.trend_weight) || 5,
      }
    : DEFAULT_WEIGHTS;

  // Check cancellation status
  const isCancellationStatus = [
    "cancellation_requested",
    "cancellation_signaled",
    "notice_period",
    "sinalizou_cancelamento",
    "cumprindo_aviso",
  ].includes(projectStatus?.toLowerCase() || "");

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const currentDay = today.getDate();
  const timeElapsedPercent = currentDay / daysInMonth;

  // 1. SATISFACTION SCORE (CSAT + NPS)
  let satisfactionScore = 50;

  const { data: npsData } = await supabase
    .from("onboarding_nps_responses")
    .select("score")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (npsData && npsData.length > 0) {
    const avgNps = npsData.reduce((sum: number, r: any) => sum + r.score, 0) / npsData.length;
    satisfactionScore = Math.min(100, Math.max(0, avgNps * 10));
  }

  const { data: csatData } = await supabase
    .from("csat_responses")
    .select("score")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (csatData && csatData.length > 0) {
    const avgCsat = csatData.reduce((sum: number, r: any) => sum + r.score, 0) / csatData.length;
    const csatScore = avgCsat * 20;
    satisfactionScore = (satisfactionScore + csatScore) / 2;
  }

  // 2. GOALS SCORE - Significantly improved logic
  let goalsScore = 0; // Start at 0 instead of 50

  if (companyId) {
    const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const monthEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${daysInMonth}`;
    
    // Get MONETARY KPIs only for goal tracking
    const { data: companyKpis } = await supabase
      .from("company_kpis")
      .select("id, target_value, kpi_type, periodicity")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .eq("kpi_type", "monetary");
    
    if (companyKpis && companyKpis.length > 0) {
      // Has goals configured
      details.hasGoalsConfigured = true;
      
      // Calculate total monthly target
      let totalMonthlyTarget = 0;
      const kpiIds = companyKpis.map((kpi: any) => kpi.id);
      
      companyKpis.forEach((kpi: any) => {
        if (kpi.target_value > 0) {
          if (kpi.periodicity === "daily") {
            totalMonthlyTarget += kpi.target_value * daysInMonth;
          } else if (kpi.periodicity === "weekly") {
            totalMonthlyTarget += kpi.target_value * Math.ceil(daysInMonth / 7);
          } else {
            totalMonthlyTarget += kpi.target_value;
          }
        }
      });
      
      if (totalMonthlyTarget > 0) {
        // Get KPI entries for current month
        const { data: kpiEntries } = await supabase
          .from("kpi_entries")
          .select("kpi_id, value")
          .eq("company_id", companyId)
          .in("kpi_id", kpiIds)
          .gte("entry_date", monthStart)
          .lte("entry_date", monthEnd);
        
        if (kpiEntries && kpiEntries.length > 0) {
          details.hasKpiEntries = true;
          const totalRealized = kpiEntries.reduce((sum: number, e: any) => sum + (e.value || 0), 0);
          
          // Calculate projection percentage
          const projectionPercent = timeElapsedPercent > 0 
            ? ((totalRealized / totalMonthlyTarget) / timeElapsedPercent) * 100 
            : 0;
          
          details.goalProjection = projectionPercent;
          
          // Score based on projection:
          // - 100%+ projection = 100 points
          // - 80-99% = proportional 60-80 points
          // - 50-79% = proportional 30-60 points
          // - Below 50% = proportional 0-30 points
          if (projectionPercent >= 100) {
            goalsScore = 100;
          } else if (projectionPercent >= 80) {
            goalsScore = 60 + ((projectionPercent - 80) / 20) * 40;
          } else if (projectionPercent >= 50) {
            goalsScore = 30 + ((projectionPercent - 50) / 30) * 30;
          } else {
            goalsScore = (projectionPercent / 50) * 30;
          }
        } else {
          // Has goals but NO KPI ENTRIES this month
          details.hasKpiEntries = false;
          goalsScore = 10; // Very low score
          details.noKpiEntriesPenalty = 40;
        }
      } else {
        // Has KPIs but target is 0
        details.hasGoalsConfigured = false;
        goalsScore = 20;
        details.noGoalPenalty = 30;
      }
    } else {
      // NO GOALS CONFIGURED AT ALL
      details.hasGoalsConfigured = false;
      goalsScore = 15;
      details.noGoalPenalty = 35;
    }
  } else {
    // No company linked
    goalsScore = 25;
  }
  
  // Fallback to legacy monthly_goals if still low
  if (goalsScore < 30 && !details.hasGoalsConfigured) {
    const { data: goalsData } = await supabase
      .from("onboarding_monthly_goals")
      .select("sales_target, sales_result")
      .eq("project_id", projectId)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(3);

    if (goalsData && goalsData.length > 0) {
      const goalsWithTargets = goalsData.filter((g: any) => g.sales_target && g.sales_target > 0);
      if (goalsWithTargets.length > 0) {
        details.hasGoalsConfigured = true;
        const avgAchievement =
          goalsWithTargets.reduce((sum: number, g: any) => {
            const achievement = ((g.sales_result || 0) / g.sales_target) * 100;
            return sum + Math.min(100, achievement);
          }, 0) / goalsWithTargets.length;
        goalsScore = Math.min(100, avgAchievement);
        details.goalProjection = avgAchievement;
      }
    }
  }

  // 3. COMMERCIAL SCORE
  let commercialScore = 50;

  if (companyId) {
    const { data: salesHistory } = await supabase
      .from("company_sales_history")
      .select("revenue, is_pre_unv")
      .eq("company_id", companyId)
      .order("month_year", { ascending: false })
      .limit(24);

    if (salesHistory && salesHistory.length > 0) {
      const preUnv = salesHistory.filter((s: any) => s.is_pre_unv);
      const postUnv = salesHistory.filter((s: any) => !s.is_pre_unv);

      if (preUnv.length > 0 && postUnv.length > 0) {
        const avgPre = preUnv.reduce((sum: number, s: any) => sum + (s.revenue || 0), 0) / preUnv.length;
        const avgPost = postUnv.reduce((sum: number, s: any) => sum + (s.revenue || 0), 0) / postUnv.length;

        if (avgPre > 0) {
          const growth = ((avgPost - avgPre) / avgPre) * 100;
          commercialScore = Math.min(100, Math.max(0, 50 + growth));
        }
      }
    }
  }

  // 4. ENGAGEMENT SCORE - Enhanced with meetings and task bonuses
  let engagementScore = 0; // Start at 0

  const { data: tasks } = await supabase
    .from("onboarding_tasks")
    .select("status, due_date, completed_at, is_internal")
    .eq("project_id", projectId);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  if (tasks && tasks.length > 0) {
    // Filter out internal tasks for engagement calculation
    const clientTasks = tasks.filter((t: any) => !t.is_internal);
    const totalTasks = clientTasks.length || 1;
    
    const completed = clientTasks.filter((t: any) => t.status === "completed").length;
    const completionRate = (completed / totalTasks) * 100;

    // Overdue tasks penalty
    const overdue = clientTasks.filter(
      (t: any) => t.status !== "completed" && t.due_date && new Date(t.due_date) < today
    ).length;
    details.overdueTasksCount = overdue;
    
    // Count recently completed tasks (last 30 days)
    const recentlyCompleted = clientTasks.filter(
      (t: any) => t.status === "completed" && t.completed_at && new Date(t.completed_at) >= thirtyDaysAgo
    ).length;
    details.completedTasksRecent = recentlyCompleted;

    // Base engagement from completion rate
    engagementScore = Math.min(70, completionRate * 0.7);
    
    // Penalty for overdue tasks: -3 points per overdue task (max -30)
    details.overduePenalty = Math.min(30, overdue * 3);
    
    // Bonus for recently completed tasks: +2 points per task (max +20)
    details.completedTasksBonus = Math.min(20, recentlyCompleted * 2);
    
    // Calculate days since last task completion
    const completedTasks = clientTasks.filter((t: any) => t.status === "completed" && t.completed_at);
    if (completedTasks.length > 0) {
      const lastCompletedDate = completedTasks
        .map((t: any) => new Date(t.completed_at))
        .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];
      
      details.daysSinceLastTask = Math.floor((today.getTime() - lastCompletedDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      details.daysSinceLastTask = 60;
    }
  }

  // Get meetings data
  const { data: meetings } = await supabase
    .from("onboarding_meeting_notes")
    .select("meeting_date, status")
    .eq("project_id", projectId)
    .gte("meeting_date", thirtyDaysAgo.toISOString());

  if (meetings && meetings.length > 0) {
    const completedMeetings = meetings.filter((m: any) => m.status === "completed" || m.status === "concluída");
    details.meetingsCount = completedMeetings.length;
    
    // Bonus for meetings: +5 points per meeting in last 30 days (max +15)
    details.meetingBonus = Math.min(15, completedMeetings.length * 5);
    
    // Days since last meeting
    if (completedMeetings.length > 0) {
      const lastMeetingDate = completedMeetings
        .map((m: any) => new Date(m.meeting_date))
        .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];
      
      details.daysSinceLastMeeting = Math.floor((today.getTime() - lastMeetingDate.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  // Get client access data - NEW: Client portal access contributes to engagement
  const { data: clientAccess } = await supabase
    .from("client_access_logs")
    .select("id, login_at, session_duration_minutes")
    .eq("project_id", projectId)
    .gte("login_at", thirtyDaysAgo.toISOString());

  details.clientAccessCount = 0;
  details.clientAccessBonus = 0;
  details.totalClientSessionMinutes = 0;
  details.daysSinceLastAccess = 60; // Default to max penalty

  if (clientAccess && clientAccess.length > 0) {
    details.clientAccessCount = clientAccess.length;
    
    // Calculate total session time
    const totalMinutes = clientAccess.reduce((acc: number, a: any) => {
      return acc + (a.session_duration_minutes || 0);
    }, 0);
    details.totalClientSessionMinutes = totalMinutes;
    
    // Bonus for client portal access: +3 points per access in last 30 days (max +15)
    details.clientAccessBonus = Math.min(15, clientAccess.length * 3);
    
    // Additional bonus for significant time spent: +1 point per 30 min (max +10)
    const timeBonus = Math.min(10, Math.floor(totalMinutes / 30));
    details.clientAccessBonus += timeBonus;
    
    // Days since last access
    const lastAccessDate = clientAccess
      .map((a: any) => new Date(a.login_at))
      .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];
    
    details.daysSinceLastAccess = Math.floor((today.getTime() - lastAccessDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Get client activity data - More specific actions get extra bonus
  const { data: clientActivities } = await supabase
    .from("client_activity_logs")
    .select("action_type")
    .eq("project_id", projectId)
    .gte("created_at", thirtyDaysAgo.toISOString());

  details.clientActivityCount = 0;
  details.clientActivityBonus = 0;

  if (clientActivities && clientActivities.length > 0) {
    details.clientActivityCount = clientActivities.length;
    
    // Count high-value actions (creating jobs, adding candidates, etc.)
    const highValueActions = clientActivities.filter((a: any) => 
      ['job_opening_created', 'candidate_added', 'task_completed', 'nps_submitted'].includes(a.action_type)
    ).length;
    
    // Bonus for activities: +1 point per 5 activities (max +10)
    details.clientActivityBonus = Math.min(10, Math.floor(clientActivities.length / 5));
    
    // Extra bonus for high-value actions: +2 points per action (max +10)
    details.clientActivityBonus += Math.min(10, highValueActions * 2);
  }

  // Apply engagement bonuses and penalties
  engagementScore = engagementScore - details.overduePenalty + details.completedTasksBonus + details.meetingBonus + details.clientAccessBonus + details.clientActivityBonus;
  engagementScore = Math.min(100, Math.max(0, engagementScore));

  // Inactivity penalty based on days since last task
  if (details.daysSinceLastTask >= 30) {
    details.inactivityPenalty = 25;
  } else if (details.daysSinceLastTask >= 21) {
    details.inactivityPenalty = 18;
  } else if (details.daysSinceLastTask >= 14) {
    details.inactivityPenalty = 12;
  } else if (details.daysSinceLastTask >= 7) {
    details.inactivityPenalty = 6;
  }

  // 5. SUPPORT SCORE
  let supportScore = 70;

  const { data: tickets } = await supabase
    .from("onboarding_tickets")
    .select("status, created_at, updated_at")
    .eq("project_id", projectId);

  if (tickets && tickets.length > 0) {
    const resolved = tickets.filter((t: any) => t.status === "resolved" || t.status === "closed").length;
    const resolutionRate = (resolved / tickets.length) * 100;

    const openTickets = tickets.filter((t: any) => t.status !== "resolved" && t.status !== "closed").length;
    const openPenalty = Math.min(30, openTickets * 5);

    supportScore = Math.min(100, Math.max(0, resolutionRate - openPenalty));
  }

  // 6. TREND SCORE
  let trendScore = 50;
  let trendDirection = "stable";

  const { data: recentSnapshots } = await supabase
    .from("health_score_snapshots")
    .select("total_score, snapshot_date")
    .eq("project_id", projectId)
    .gte("snapshot_date", thirtyDaysAgo.toISOString().split("T")[0])
    .order("snapshot_date", { ascending: true });

  if (recentSnapshots && recentSnapshots.length >= 2) {
    const firstScore = recentSnapshots[0].total_score;
    const lastScore = recentSnapshots[recentSnapshots.length - 1].total_score;
    const change = Number(lastScore) - Number(firstScore);

    if (change > 5) {
      trendDirection = "rising";
      trendScore = Math.min(100, 60 + change);
    } else if (change < -5) {
      trendDirection = "falling";
      trendScore = Math.max(0, 40 + change);
    }
  }

  // Calculate weighted total
  let totalScore = Math.round(
    (satisfactionScore * weights.satisfaction_weight) / 100 +
      (goalsScore * weights.goals_weight) / 100 +
      (commercialScore * weights.commercial_weight) / 100 +
      (engagementScore * weights.engagement_weight) / 100 +
      (supportScore * weights.support_weight) / 100 +
      (trendScore * weights.trend_weight) / 100
  );

  // Apply global bonuses and penalties

  // BONUS: Projecting to meet goal (+10 points)
  if (details.goalProjection >= 100 && details.hasKpiEntries) {
    details.projectionBonus = 10;
    totalScore = Math.min(100, totalScore + 10);
  }

  // PENALTY: No goals configured (-15 points applied through low goalsScore already)
  // PENALTY: No KPI entries this month (-10 additional)
  if (details.hasGoalsConfigured && !details.hasKpiEntries) {
    totalScore = Math.max(0, totalScore - 10);
  }

  // PENALTY: Global inactivity
  totalScore = Math.max(0, totalScore - details.inactivityPenalty);

  // Check for recent renewal (within last 90 days) - add +20 bonus
  if (companyId) {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const { data: companyData } = await supabase
      .from("onboarding_companies")
      .select("renewed_at")
      .eq("id", companyId)
      .single();
    
    if (companyData?.renewed_at) {
      const renewedAt = new Date(companyData.renewed_at);
      if (renewedAt >= ninetyDaysAgo) {
        details.renewalBonus = 20;
        totalScore = Math.min(100, totalScore + 20);
      }
    }
  }

  // Apply cancellation penalty (-35 points)
  if (isCancellationStatus) {
    details.cancellationPenalty = 35;
    totalScore = Math.max(0, totalScore - 35);
  }

  // Ensure minimum score boundaries
  totalScore = Math.min(100, Math.max(0, totalScore));

  // Determine risk level
  let riskLevel = "healthy";
  if (isCancellationStatus) {
    riskLevel = "critical";
  } else if (totalScore < 40) {
    riskLevel = "critical";
  } else if (totalScore < 55) {
    riskLevel = "at_risk";
  } else if (totalScore < 70) {
    riskLevel = "attention";
  } else if (totalScore < 85) {
    riskLevel = "healthy";
  } else {
    riskLevel = "excellent";
  }

  // Get existing score
  const { data: existingScore } = await supabase
    .from("client_health_scores")
    .select("id, total_score")
    .eq("project_id", projectId)
    .single();

  const scorePayload = {
    project_id: projectId,
    total_score: totalScore,
    satisfaction_score: Math.round(satisfactionScore),
    goals_score: Math.round(goalsScore),
    commercial_score: Math.round(commercialScore),
    engagement_score: Math.round(engagementScore),
    support_score: Math.round(supportScore),
    trend_score: Math.round(trendScore),
    risk_level: riskLevel,
    trend_direction: trendDirection,
    last_calculated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existingScore) {
    await supabase.from("client_health_scores").update(scorePayload).eq("id", existingScore.id);
  } else {
    await supabase.from("client_health_scores").insert(scorePayload);
  }

  // Save daily snapshot
  const todayStr = new Date().toISOString().split("T")[0];
  const { data: existingSnapshot } = await supabase
    .from("health_score_snapshots")
    .select("id")
    .eq("project_id", projectId)
    .eq("snapshot_date", todayStr)
    .single();

  const snapshotPayload = {
    project_id: projectId,
    snapshot_date: todayStr,
    total_score: totalScore,
    satisfaction_score: Math.round(satisfactionScore),
    goals_score: Math.round(goalsScore),
    commercial_score: Math.round(commercialScore),
    engagement_score: Math.round(engagementScore),
    support_score: Math.round(supportScore),
    trend_score: Math.round(trendScore),
    risk_level: riskLevel,
  };

  if (existingSnapshot) {
    await supabase.from("health_score_snapshots").update(snapshotPayload).eq("id", existingSnapshot.id);
  } else {
    await supabase.from("health_score_snapshots").insert(snapshotPayload);
  }

  // Log event with detailed breakdown
  const eventData = {
    ...scorePayload,
    details: {
      goal_projection: Math.round(details.goalProjection),
      has_goals_configured: details.hasGoalsConfigured,
      has_kpi_entries: details.hasKpiEntries,
      overdue_tasks_count: details.overdueTasksCount,
      completed_tasks_recent: details.completedTasksRecent,
      meetings_count_30d: details.meetingsCount,
      days_since_last_task: details.daysSinceLastTask,
      days_since_last_meeting: details.daysSinceLastMeeting,
      penalties: {
        inactivity: details.inactivityPenalty,
        no_goal: details.noGoalPenalty,
        no_kpi_entries: details.noKpiEntriesPenalty,
        overdue_tasks: details.overduePenalty,
        cancellation: details.cancellationPenalty,
      },
      bonuses: {
        meetings: details.meetingBonus,
        completed_tasks: details.completedTasksBonus,
        projection: details.projectionBonus,
        renewal: details.renewalBonus,
      },
    },
  };

  await supabase.from("health_score_events").insert({
    project_id: projectId,
    event_type: "score_calculated",
    event_data: eventData,
    previous_score: existingScore?.total_score || null,
    new_score: totalScore,
    triggered_by: "automatic",
  });

  console.log(`Project ${projectId} - Score: ${totalScore}, Goals: ${goalsScore}, Engagement: ${engagementScore}, Details:`, details);

  return totalScore;
}
