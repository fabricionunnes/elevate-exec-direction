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
  satisfaction_weight: 25,
  goals_weight: 25,
  commercial_weight: 20,
  engagement_weight: 15,
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

async function calculateProjectHealthScore(
  supabase: any,
  projectId: string,
  companyId: string | null,
  projectStatus: string | null
): Promise<number> {
  // Get weights for this project
  const { data: weightsData } = await supabase
    .from("health_score_weights")
    .select("*")
    .eq("project_id", projectId)
    .single();

  const weights: HealthScoreWeights = weightsData
    ? {
        satisfaction_weight: Number(weightsData.satisfaction_weight) || 25,
        goals_weight: Number(weightsData.goals_weight) || 25,
        commercial_weight: Number(weightsData.commercial_weight) || 20,
        engagement_weight: Number(weightsData.engagement_weight) || 15,
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

  // 2. GOALS SCORE (using company_kpis + kpi_entries for projection)
  let goalsScore = 50;
  let isProjectingToMeetGoal = false;

  if (companyId) {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const currentDay = today.getDate();
    const timeElapsedPercent = currentDay / daysInMonth;
    
    const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const monthEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${daysInMonth}`;
    
    // Get company KPIs
    const { data: companyKpis } = await supabase
      .from("company_kpis")
      .select("id, target_value, kpi_type, periodicity")
      .eq("company_id", companyId)
      .eq("is_active", true);
    
    if (companyKpis && companyKpis.length > 0) {
      // Get KPI entries for current month
      const { data: kpiEntries } = await supabase
        .from("kpi_entries")
        .select("kpi_id, value")
        .eq("company_id", companyId)
        .gte("entry_date", monthStart)
        .lte("entry_date", monthEnd);
      
      // Calculate monthly target
      let totalMonthlyTarget = 0;
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
      
      if (totalMonthlyTarget > 0 && kpiEntries) {
        const totalRealized = kpiEntries.reduce((sum: number, e: any) => sum + (e.value || 0), 0);
        
        // Calculate projection percentage
        const projectionPercent = timeElapsedPercent > 0 
          ? ((totalRealized / totalMonthlyTarget) / timeElapsedPercent) * 100 
          : 0;
        
        // Convert projection to score (100% projection = 100 score)
        goalsScore = Math.min(100, Math.max(0, projectionPercent));
        
        // Flag if projecting to meet goal
        isProjectingToMeetGoal = projectionPercent >= 100;
      }
    }
  }
  
  // Fallback to legacy monthly_goals if no KPI data
  if (goalsScore === 50) {
    const { data: goalsData } = await supabase
      .from("onboarding_monthly_goals")
      .select("sales_target, sales_result")
      .eq("project_id", projectId)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(6);

    if (goalsData && goalsData.length > 0) {
      const goalsWithTargets = goalsData.filter((g: any) => g.sales_target && g.sales_target > 0);
      if (goalsWithTargets.length > 0) {
        const avgAchievement =
          goalsWithTargets.reduce((sum: number, g: any) => {
            const achievement = ((g.sales_result || 0) / g.sales_target) * 100;
            return sum + Math.min(100, achievement);
          }, 0) / goalsWithTargets.length;
        goalsScore = Math.min(100, avgAchievement);
        isProjectingToMeetGoal = avgAchievement >= 100;
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

  // 4. ENGAGEMENT SCORE (includes inactivity penalty)
  let engagementScore = 50;
  let daysSinceLastCompletion = 0;

  const { data: tasks } = await supabase
    .from("onboarding_tasks")
    .select("status, due_date, completed_at")
    .eq("project_id", projectId);

  if (tasks && tasks.length > 0) {
    const completed = tasks.filter((t: any) => t.status === "completed").length;
    const total = tasks.length;
    const completionRate = (completed / total) * 100;

    const today = new Date();
    const overdue = tasks.filter(
      (t: any) => t.status !== "completed" && t.due_date && new Date(t.due_date) < today
    ).length;

    const overdueRate = (overdue / total) * 100;
    engagementScore = Math.min(100, Math.max(0, completionRate - overdueRate));
    
    // Calculate days since last task completion
    const completedTasks = tasks.filter((t: any) => t.status === "completed" && t.completed_at);
    if (completedTasks.length > 0) {
      const lastCompletedDate = completedTasks
        .map((t: any) => new Date(t.completed_at))
        .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];
      
      daysSinceLastCompletion = Math.floor((today.getTime() - lastCompletedDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      // No completed tasks ever - consider it as very inactive
      daysSinceLastCompletion = 30;
    }
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

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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

  // Apply bonuses and penalties
  
  // BONUS: Projecting to meet goal (+15 points)
  if (isProjectingToMeetGoal) {
    totalScore = Math.min(100, totalScore + 15);
  }
  
  // Legacy bonus for meeting goals (if goalsScore >= 80, add +10)
  if (goalsScore >= 80 && !isProjectingToMeetGoal) {
    totalScore = Math.min(100, totalScore + 10);
  }
  
  // PENALTY: Inactivity - no task completed recently
  // 7+ days without completion: -5 points
  // 14+ days without completion: -10 points  
  // 21+ days without completion: -15 points
  // 30+ days without completion: -20 points
  if (daysSinceLastCompletion >= 30) {
    totalScore = Math.max(0, totalScore - 20);
  } else if (daysSinceLastCompletion >= 21) {
    totalScore = Math.max(0, totalScore - 15);
  } else if (daysSinceLastCompletion >= 14) {
    totalScore = Math.max(0, totalScore - 10);
  } else if (daysSinceLastCompletion >= 7) {
    totalScore = Math.max(0, totalScore - 5);
  }

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
        totalScore = Math.min(100, totalScore + 20);
      }
    }
  }

  // Apply cancellation penalty (reduces score)
  if (isCancellationStatus) {
    totalScore = Math.max(0, totalScore - 30);
  }

  // Determine risk level
  let riskLevel = "healthy";
  if (isCancellationStatus) {
    riskLevel = "critical";
  } else if (totalScore < 40) {
    riskLevel = "critical";
  } else if (totalScore < 60) {
    riskLevel = "at_risk";
  } else if (totalScore < 80) {
    riskLevel = "attention";
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
  const today = new Date().toISOString().split("T")[0];
  const { data: existingSnapshot } = await supabase
    .from("health_score_snapshots")
    .select("id")
    .eq("project_id", projectId)
    .eq("snapshot_date", today)
    .single();

  const snapshotPayload = {
    project_id: projectId,
    snapshot_date: today,
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

  // Log event
  await supabase.from("health_score_events").insert({
    project_id: projectId,
    event_type: "score_calculated",
    event_data: scorePayload,
    previous_score: existingScore?.total_score || null,
    new_score: totalScore,
    triggered_by: "automatic",
  });

  return totalScore;
}
