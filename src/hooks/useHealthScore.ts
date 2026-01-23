import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface HealthScoreWeights {
  satisfaction_weight: number;
  goals_weight: number;
  commercial_weight: number;
  engagement_weight: number;
  support_weight: number;
  trend_weight: number;
}

interface HealthScoreData {
  total_score: number;
  satisfaction_score: number;
  goals_score: number;
  commercial_score: number;
  engagement_score: number;
  support_score: number;
  trend_score: number;
  risk_level: string;
  trend_direction: string;
  last_calculated_at: string | null;
}

interface HealthScoreSnapshot {
  id: string;
  snapshot_date: string;
  total_score: number;
  risk_level: string;
}

const DEFAULT_WEIGHTS: HealthScoreWeights = {
  satisfaction_weight: 25,
  goals_weight: 25,
  commercial_weight: 20,
  engagement_weight: 15,
  support_weight: 10,
  trend_weight: 5,
};

export const useHealthScore = (projectId: string | undefined) => {
  const [score, setScore] = useState<HealthScoreData | null>(null);
  const [weights, setWeights] = useState<HealthScoreWeights>(DEFAULT_WEIGHTS);
  const [snapshots, setSnapshots] = useState<HealthScoreSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  // Check if score needs auto-calculation (missing or older than 24h)
  const isScoreStale = (lastCalculatedAt: string | null): boolean => {
    if (!lastCalculatedAt) return true;
    
    const lastCalculated = new Date(lastCalculatedAt);
    const now = new Date();
    const hoursSinceCalc = (now.getTime() - lastCalculated.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceCalc > 24;
  };

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      // Fetch weights
      const { data: weightsData } = await supabase
        .from("health_score_weights")
        .select("*")
        .eq("project_id", projectId)
        .single();

      if (weightsData) {
        setWeights({
          satisfaction_weight: Number(weightsData.satisfaction_weight) || 25,
          goals_weight: Number(weightsData.goals_weight) || 25,
          commercial_weight: Number(weightsData.commercial_weight) || 20,
          engagement_weight: Number(weightsData.engagement_weight) || 15,
          support_weight: Number(weightsData.support_weight) || 10,
          trend_weight: Number(weightsData.trend_weight) || 5,
        });
      }

      // Fetch current score
      const { data: scoreData } = await supabase
        .from("client_health_scores")
        .select("*")
        .eq("project_id", projectId)
        .single();

      if (scoreData) {
        setScore({
          total_score: Number(scoreData.total_score) || 0,
          satisfaction_score: Number(scoreData.satisfaction_score) || 0,
          goals_score: Number(scoreData.goals_score) || 0,
          commercial_score: Number(scoreData.commercial_score) || 0,
          engagement_score: Number(scoreData.engagement_score) || 0,
          support_score: Number(scoreData.support_score) || 0,
          trend_score: Number(scoreData.trend_score) || 0,
          risk_level: scoreData.risk_level || "healthy",
          trend_direction: scoreData.trend_direction || "stable",
          last_calculated_at: scoreData.last_calculated_at,
        });
        
        // Check if score is stale and needs auto-calculation
        if (isScoreStale(scoreData.last_calculated_at)) {
          // Will trigger calculation after loading completes
          setShouldAutoCalculate(true);
        }
      } else {
        // No score exists - trigger auto-calculation
        setShouldAutoCalculate(true);
      }

      // Fetch snapshots (last 90 days)
      const { data: snapshotsData } = await supabase
        .from("health_score_snapshots")
        .select("id, snapshot_date, total_score, risk_level")
        .eq("project_id", projectId)
        .order("snapshot_date", { ascending: false })
        .limit(90);

      setSnapshots(snapshotsData || []);
    } catch (error) {
      console.error("Error fetching health score:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-calculate when needed (after initial load)
  const [shouldAutoCalculate, setShouldAutoCalculate] = useState(false);
  
  useEffect(() => {
    if (shouldAutoCalculate && !loading && !calculating) {
      setShouldAutoCalculate(false);
      // Small delay to avoid UI flicker
      const timer = setTimeout(() => {
        calculateScoreInternal();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoCalculate, loading, calculating]);

  const calculateScoreInternal = useCallback(async () => {
    if (!projectId) return;
    setCalculating(true);

    try {
      // Get project and company info
      const { data: project } = await supabase
        .from("onboarding_projects")
        .select("id, onboarding_company_id, current_nps, status")
        .eq("id", projectId)
        .single();

      if (!project) throw new Error("Project not found");

      const companyId = project.onboarding_company_id;
      const projectStatus = project.status;

      // Check if project has cancellation-related status (impacts score negatively)
      const isCancellationStatus = [
        "cancellation_requested", 
        "cancellation_signaled",
        "notice_period",
        "sinalizou_cancelamento",
        "cumprindo_aviso"
      ].includes(projectStatus?.toLowerCase() || "");

      // 1. SATISFACTION SCORE (CSAT + NPS)
      let satisfactionScore = 50; // Base
      
      // Get NPS
      const { data: npsData } = await supabase
        .from("onboarding_nps_responses")
        .select("score")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (npsData && npsData.length > 0) {
        const avgNps = npsData.reduce((sum, r) => sum + r.score, 0) / npsData.length;
        // NPS 10 = 100 points, NPS 0 = 0 points
        satisfactionScore = Math.min(100, Math.max(0, avgNps * 10));
      }

      // Get CSAT
      const { data: csatData } = await supabase
        .from("csat_responses")
        .select("score")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (csatData && csatData.length > 0) {
        const avgCsat = csatData.reduce((sum, r) => sum + r.score, 0) / csatData.length;
        // CSAT 5 = 100 points, CSAT 1 = 20 points
        const csatScore = avgCsat * 20;
        satisfactionScore = (satisfactionScore + csatScore) / 2;
      }

      // 2. GOALS SCORE (Metas)
      let goalsScore = 50; // Base
      
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const { data: goalsData } = await supabase
        .from("onboarding_monthly_goals")
        .select("sales_target, sales_result")
        .eq("project_id", projectId)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(6);

      if (goalsData && goalsData.length > 0) {
        const goalsWithTargets = goalsData.filter(g => g.sales_target && g.sales_target > 0);
        if (goalsWithTargets.length > 0) {
          const avgAchievement = goalsWithTargets.reduce((sum, g) => {
            const achievement = ((g.sales_result || 0) / g.sales_target) * 100;
            return sum + Math.min(100, achievement);
          }, 0) / goalsWithTargets.length;
          goalsScore = Math.min(100, avgAchievement);
        }
      }

      // 3. COMMERCIAL SCORE (Before vs After)
      let commercialScore = 50; // Base
      
      if (companyId) {
        const { data: salesHistory } = await supabase
          .from("company_sales_history")
          .select("revenue, is_pre_unv")
          .eq("company_id", companyId)
          .order("month_year", { ascending: false })
          .limit(24);

        if (salesHistory && salesHistory.length > 0) {
          const preUnv = salesHistory.filter(s => s.is_pre_unv);
          const postUnv = salesHistory.filter(s => !s.is_pre_unv);

          if (preUnv.length > 0 && postUnv.length > 0) {
            const avgPre = preUnv.reduce((sum, s) => sum + (s.revenue || 0), 0) / preUnv.length;
            const avgPost = postUnv.reduce((sum, s) => sum + (s.revenue || 0), 0) / postUnv.length;

            if (avgPre > 0) {
              const growth = ((avgPost - avgPre) / avgPre) * 100;
              // Growth 50%+ = 100, 0% = 50, -50% = 0
              commercialScore = Math.min(100, Math.max(0, 50 + growth));
            }
          }
        }
      }

      // 4. ENGAGEMENT SCORE (Tasks)
      let engagementScore = 50; // Base
      
      const { data: tasks } = await supabase
        .from("onboarding_tasks")
        .select("status, due_date, completed_at")
        .eq("project_id", projectId);

      if (tasks && tasks.length > 0) {
        const completed = tasks.filter(t => t.status === "completed").length;
        const total = tasks.length;
        const completionRate = (completed / total) * 100;
        
        // Check for overdue tasks
        const today = new Date();
        const overdue = tasks.filter(t => 
          t.status !== "completed" && 
          t.due_date && 
          new Date(t.due_date) < today
        ).length;
        
        const overdueRate = (overdue / total) * 100;
        
        engagementScore = Math.min(100, Math.max(0, completionRate - overdueRate));
      }

      // 5. SUPPORT SCORE (Tickets)
      let supportScore = 70; // Base (no tickets = good)
      
      const { data: tickets } = await supabase
        .from("onboarding_tickets")
        .select("status, created_at, updated_at")
        .eq("project_id", projectId);

      if (tickets && tickets.length > 0) {
        const resolved = tickets.filter(t => t.status === "resolved" || t.status === "closed").length;
        const resolutionRate = (resolved / tickets.length) * 100;
        
        // Penalize based on open tickets count
        const openTickets = tickets.filter(t => t.status !== "resolved" && t.status !== "closed").length;
        const openPenalty = Math.min(30, openTickets * 5);
        
        supportScore = Math.min(100, Math.max(0, resolutionRate - openPenalty));
      }

      // 6. TREND SCORE (Last 30 days vs previous 30)
      let trendScore = 50; // Base
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: recentSnapshots } = await supabase
        .from("health_score_snapshots")
        .select("total_score, snapshot_date")
        .eq("project_id", projectId)
        .gte("snapshot_date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("snapshot_date", { ascending: true });

      let trendDirection = "stable";
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
        } else {
          trendScore = 50;
        }
      }

      // Calculate weighted total
      let totalScore = Math.round(
        (satisfactionScore * weights.satisfaction_weight / 100) +
        (goalsScore * weights.goals_weight / 100) +
        (commercialScore * weights.commercial_weight / 100) +
        (engagementScore * weights.engagement_weight / 100) +
        (supportScore * weights.support_weight / 100) +
        (trendScore * weights.trend_weight / 100)
      );

      // Apply bonuses
      // Bonus for meeting goals (if goalsScore >= 80, add +10)
      if (goalsScore >= 80) {
        totalScore = Math.min(100, totalScore + 10);
      }

      // Check for recent renewal (within last 30 days) - DOUBLE the score
      if (companyId) {
        const thirtyDaysAgoRenewal = new Date();
        thirtyDaysAgoRenewal.setDate(thirtyDaysAgoRenewal.getDate() - 30);
        
        const { data: companyData } = await supabase
          .from("onboarding_companies")
          .select("renewed_at")
          .eq("id", companyId)
          .single();
        
        if (companyData?.renewed_at) {
          const renewedAt = new Date(companyData.renewed_at);
          if (renewedAt >= thirtyDaysAgoRenewal) {
            // Double the score on recent renewal (cap at 100)
            totalScore = Math.min(100, totalScore * 2);
          }
        }
      }

      // Apply cancellation penalty (reduces score)
      if (isCancellationStatus) {
        totalScore = Math.max(0, totalScore - 30); // -30 points penalty
      }

      // Determine risk level
      let riskLevel = "healthy";
      if (isCancellationStatus) {
        riskLevel = "critical"; // Always critical if cancellation requested
      } else if (totalScore < 40) {
        riskLevel = "critical";
      } else if (totalScore < 60) {
        riskLevel = "at_risk";
      } else if (totalScore < 80) {
        riskLevel = "attention";
      }

      // Save score
      const { data: existingScore } = await supabase
        .from("client_health_scores")
        .select("id")
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
        await supabase
          .from("client_health_scores")
          .update(scorePayload)
          .eq("id", existingScore.id);
      } else {
        await supabase
          .from("client_health_scores")
          .insert(scorePayload);
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
        await supabase
          .from("health_score_snapshots")
          .update(snapshotPayload)
          .eq("id", existingSnapshot.id);
      } else {
        await supabase
          .from("health_score_snapshots")
          .insert(snapshotPayload);
      }

      // Log event
      await supabase.from("health_score_events").insert({
        project_id: projectId,
        event_type: "score_calculated",
        event_data: scorePayload,
        previous_score: score?.total_score || null,
        new_score: totalScore,
        triggered_by: "manual",
      });

      // Refresh data
      await fetchData();
    } catch (error) {
      console.error("Error calculating health score:", error);
    } finally {
      setCalculating(false);
    }
  }, [projectId, weights, score, fetchData]);

  const updateWeights = async (newWeights: HealthScoreWeights) => {
    if (!projectId) return;

    try {
      const { data: existing } = await supabase
        .from("health_score_weights")
        .select("id")
        .eq("project_id", projectId)
        .single();

      if (existing) {
        await supabase
          .from("health_score_weights")
          .update({ ...newWeights, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("health_score_weights")
          .insert({ project_id: projectId, ...newWeights });
      }

      setWeights(newWeights);
    } catch (error) {
      console.error("Error updating weights:", error);
    }
  };

  return {
    score,
    weights,
    snapshots,
    loading,
    calculating,
    calculateScore: calculateScoreInternal,
    updateWeights,
    refetch: fetchData,
  };
};

export const getRiskLevelInfo = (riskLevel: string) => {
  switch (riskLevel) {
    case "healthy":
      return { label: "Saudável", color: "text-green-600", bg: "bg-green-100", border: "border-green-500" };
    case "attention":
      return { label: "Atenção", color: "text-yellow-600", bg: "bg-yellow-100", border: "border-yellow-500" };
    case "at_risk":
      return { label: "Em Risco", color: "text-orange-600", bg: "bg-orange-100", border: "border-orange-500" };
    case "critical":
      return { label: "Crítico", color: "text-red-600", bg: "bg-red-100", border: "border-red-500" };
    default:
      return { label: "Desconhecido", color: "text-gray-600", bg: "bg-gray-100", border: "border-gray-500" };
  }
};

export const getTrendInfo = (trend: string) => {
  switch (trend) {
    case "rising":
      return { label: "Subindo", icon: "TrendingUp", color: "text-green-600" };
    case "falling":
      return { label: "Caindo", icon: "TrendingDown", color: "text-red-600" };
    default:
      return { label: "Estável", icon: "Minus", color: "text-gray-600" };
  }
};
