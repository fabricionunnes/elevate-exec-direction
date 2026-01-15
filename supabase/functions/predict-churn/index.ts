import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RiskFactor {
  factor: string;
  weight: number;
  score: number;
  details: string;
}

interface ProjectData {
  id: string;
  company_name: string;
  product_name: string;
  status: string;
  start_date: string;
  health_score?: number;
  nps_avg?: number;
  csat_avg?: number;
  tasks_completed_rate?: number;
  overdue_tasks?: number;
  days_since_last_meeting?: number;
  open_support_tickets?: number;
  goals_achievement_rate?: number;
  health_trend?: 'up' | 'down' | 'stable';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { project_id, calculate_all, offset, limit } = await req.json();

    let projectIds: string[] = [];

    if (calculate_all) {
      const pageSize = typeof limit === "number" && limit > 0 ? Math.min(limit, 50) : 20;
      const pageOffset = typeof offset === "number" && offset >= 0 ? offset : 0;

      // Get all active projects (paged) to avoid timeouts
      const { count } = await supabase
        .from("onboarding_projects")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      const { data: projects, error: projectsError } = await supabase
        .from("onboarding_projects")
        .select("id")
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .range(pageOffset, pageOffset + pageSize - 1);

      if (projectsError) {
        console.error("[predict-churn] Error listing projects:", projectsError);
        throw projectsError;
      }

      projectIds = projects?.map((p) => p.id) || [];

      // Attach paging metadata
      const total = count || 0;
      (req as any)._paging = {
        total,
        offset: pageOffset,
        limit: pageSize,
        has_more: pageOffset + pageSize < total,
        next_offset: pageOffset + pageSize,
      };
    } else if (project_id) {
      projectIds = [project_id];
    } else {
      return new Response(
        JSON.stringify({ error: "project_id or calculate_all required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const predictions = [];

    for (const pid of projectIds) {
      console.log("[predict-churn] Calculating prediction for project", pid);
      const prediction = await calculateChurnPrediction(supabase, pid);
      if (prediction) {
        predictions.push(prediction);
      }
    }

    const paging = (req as any)._paging;

    return new Response(
      JSON.stringify({ success: true, predictions, paging }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error predicting churn:", error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function calculateChurnPrediction(supabase: any, projectId: string) {
  // Fetch project data
  const { data: project, error: projectError } = await supabase
    .from("onboarding_projects")
    .select(
      `
      id,
      status,
      product_name,
      onboarding_companies(
        name,
        segment
      )
    `
    )
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    console.error("[predict-churn] Error fetching project:", { projectId, projectError });
    return null;
  }

  if (!project || project.status !== "active") {
    return null;
  }

  // Fetch health score data
  const { data: healthScore } = await supabase
    .from("client_health_scores")
    .select("*")
    .eq("project_id", projectId)
    .single();

  // Fetch health score snapshots for trend analysis (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: snapshots } = await supabase
    .from("health_score_snapshots")
    .select("total_score, snapshot_date")
    .eq("project_id", projectId)
    .gte("snapshot_date", thirtyDaysAgo.toISOString().split('T')[0])
    .order("snapshot_date", { ascending: true });

  // Fetch NPS responses
  const { data: npsResponses } = await supabase
    .from("onboarding_nps_responses")
    .select("score")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Fetch CSAT responses
  const { data: csatResponses } = await supabase
    .from("csat_responses")
    .select("score")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Fetch task statistics
  const { data: tasks } = await supabase
    .from("onboarding_tasks")
    .select("status, due_date")
    .eq("project_id", projectId);

  // Fetch last meeting
  const { data: lastMeeting } = await supabase
    .from("onboarding_meeting_notes")
    .select("meeting_date")
    .eq("project_id", projectId)
    .order("meeting_date", { ascending: false })
    .limit(1)
    .single();

  // Fetch open support tickets
  const { data: openTickets } = await supabase
    .from("onboarding_tickets")
    .select("id")
    .eq("project_id", projectId)
    .in("status", ["open", "in_progress"]);

  // Fetch monthly goals achievement (current month)
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: goals } = await supabase
    .from("onboarding_monthly_goals")
    .select("sales_target, sales_result")
    .eq("project_id", projectId)
    .eq("month", currentMonth)
    .eq("year", currentYear);

  // Calculate risk factors
  const riskFactors: RiskFactor[] = [];
  let totalWeightedScore = 0;
  let totalWeight = 0;

  // 1. Health Score Trend (25%)
  const healthScoreWeight = 25;
  let healthTrendScore = 0;
  let healthTrendDetails = "";
  
  if (snapshots && snapshots.length >= 2) {
    const firstScore = snapshots[0].total_score;
    const lastScore = snapshots[snapshots.length - 1].total_score;
    const change = lastScore - firstScore;
    
    if (change < -15) {
      healthTrendScore = 100;
      healthTrendDetails = `Queda acentuada de ${Math.abs(change).toFixed(0)} pontos nos últimos 30 dias`;
    } else if (change < -5) {
      healthTrendScore = 60;
      healthTrendDetails = `Queda moderada de ${Math.abs(change).toFixed(0)} pontos nos últimos 30 dias`;
    } else if (change < 0) {
      healthTrendScore = 30;
      healthTrendDetails = `Leve queda de ${Math.abs(change).toFixed(0)} pontos nos últimos 30 dias`;
    } else {
      healthTrendScore = 0;
      healthTrendDetails = `Score estável ou em alta (+${change.toFixed(0)} pontos)`;
    }
  } else if (healthScore?.total_score < 50) {
    healthTrendScore = 80;
    healthTrendDetails = `Health Score baixo: ${healthScore?.total_score?.toFixed(0) || 'N/A'}`;
  }
  
  riskFactors.push({
    factor: "Tendência do Health Score",
    weight: healthScoreWeight,
    score: healthTrendScore,
    details: healthTrendDetails
  });
  totalWeightedScore += healthTrendScore * healthScoreWeight;
  totalWeight += healthScoreWeight;

  // 2. NPS Score (20%)
  const npsWeight = 20;
  let npsScore = 0;
  let npsDetails = "";
  
  if (npsResponses && npsResponses.length > 0) {
    const avgNps = npsResponses.reduce((acc: number, r: any) => acc + r.score, 0) / npsResponses.length;
    
    if (avgNps < 5) {
      npsScore = 100;
      npsDetails = `NPS Detrator: média ${avgNps.toFixed(1)}`;
    } else if (avgNps < 7) {
      npsScore = 60;
      npsDetails = `NPS Neutro: média ${avgNps.toFixed(1)}`;
    } else if (avgNps < 9) {
      npsScore = 20;
      npsDetails = `NPS Promotor: média ${avgNps.toFixed(1)}`;
    } else {
      npsScore = 0;
      npsDetails = `NPS Alto: média ${avgNps.toFixed(1)}`;
    }
  } else {
    npsScore = 40;
    npsDetails = "Sem respostas NPS recentes";
  }
  
  riskFactors.push({
    factor: "NPS",
    weight: npsWeight,
    score: npsScore,
    details: npsDetails
  });
  totalWeightedScore += npsScore * npsWeight;
  totalWeight += npsWeight;

  // 3. Goals Achievement (20%)
  const goalsWeight = 20;
  let goalsScore = 0;
  let goalsDetails = "";
  
  if (goals && goals.length > 0) {
    const totalTarget = goals.reduce((acc: number, g: any) => acc + (g.sales_target || 0), 0);
    const totalCurrent = goals.reduce((acc: number, g: any) => acc + (g.sales_result || 0), 0);
    const achievement = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
    
    if (achievement < 50) {
      goalsScore = 100;
      goalsDetails = `Metas abaixo de 50%: ${achievement.toFixed(0)}%`;
    } else if (achievement < 70) {
      goalsScore = 60;
      goalsDetails = `Metas abaixo de 70%: ${achievement.toFixed(0)}%`;
    } else if (achievement < 90) {
      goalsScore = 20;
      goalsDetails = `Metas próximas: ${achievement.toFixed(0)}%`;
    } else {
      goalsScore = 0;
      goalsDetails = `Metas atingidas: ${achievement.toFixed(0)}%`;
    }
  } else {
    goalsScore = 30;
    goalsDetails = "Sem metas definidas para o mês";
  }
  
  riskFactors.push({
    factor: "Atingimento de Metas",
    weight: goalsWeight,
    score: goalsScore,
    details: goalsDetails
  });
  totalWeightedScore += goalsScore * goalsWeight;
  totalWeight += goalsWeight;

  // 4. Task Completion (15%)
  const tasksWeight = 15;
  let tasksScore = 0;
  let tasksDetails = "";
  
  if (tasks && tasks.length > 0) {
    const overdueTasks = tasks.filter((t: any) => 
      t.status !== 'completed' && 
      t.due_date && 
      new Date(t.due_date) < new Date()
    ).length;
    
    if (overdueTasks > 10) {
      tasksScore = 100;
      tasksDetails = `${overdueTasks} tarefas atrasadas (crítico)`;
    } else if (overdueTasks > 5) {
      tasksScore = 60;
      tasksDetails = `${overdueTasks} tarefas atrasadas`;
    } else if (overdueTasks > 2) {
      tasksScore = 30;
      tasksDetails = `${overdueTasks} tarefas atrasadas`;
    } else {
      tasksScore = 0;
      tasksDetails = `Tarefas em dia (${overdueTasks} atrasadas)`;
    }
  }
  
  riskFactors.push({
    factor: "Tarefas Atrasadas",
    weight: tasksWeight,
    score: tasksScore,
    details: tasksDetails
  });
  totalWeightedScore += tasksScore * tasksWeight;
  totalWeight += tasksWeight;

  // 5. Meeting Frequency (10%)
  const meetingsWeight = 10;
  let meetingsScore = 0;
  let meetingsDetails = "";
  
  if (lastMeeting?.meeting_date) {
    const daysSinceLastMeeting = Math.floor(
      (new Date().getTime() - new Date(lastMeeting.meeting_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceLastMeeting > 60) {
      meetingsScore = 100;
      meetingsDetails = `${daysSinceLastMeeting} dias sem reunião (crítico)`;
    } else if (daysSinceLastMeeting > 30) {
      meetingsScore = 60;
      meetingsDetails = `${daysSinceLastMeeting} dias sem reunião`;
    } else if (daysSinceLastMeeting > 14) {
      meetingsScore = 30;
      meetingsDetails = `${daysSinceLastMeeting} dias desde última reunião`;
    } else {
      meetingsScore = 0;
      meetingsDetails = `Reunião recente (${daysSinceLastMeeting} dias)`;
    }
  } else {
    meetingsScore = 80;
    meetingsDetails = "Sem reuniões registradas";
  }
  
  riskFactors.push({
    factor: "Frequência de Reuniões",
    weight: meetingsWeight,
    score: meetingsScore,
    details: meetingsDetails
  });
  totalWeightedScore += meetingsScore * meetingsWeight;
  totalWeight += meetingsWeight;

  // 6. Support Tickets (10%)
  const supportWeight = 10;
  let supportScore = 0;
  let supportDetails = "";
  
  const openTicketCount = openTickets?.length || 0;
  if (openTicketCount > 5) {
    supportScore = 100;
    supportDetails = `${openTicketCount} tickets abertos (crítico)`;
  } else if (openTicketCount > 2) {
    supportScore = 60;
    supportDetails = `${openTicketCount} tickets abertos`;
  } else if (openTicketCount > 0) {
    supportScore = 30;
    supportDetails = `${openTicketCount} ticket(s) aberto(s)`;
  } else {
    supportScore = 0;
    supportDetails = "Nenhum ticket aberto";
  }
  
  riskFactors.push({
    factor: "Tickets de Suporte",
    weight: supportWeight,
    score: supportScore,
    details: supportDetails
  });
  totalWeightedScore += supportScore * supportWeight;
  totalWeight += supportWeight;

  // Calculate final probability
  const churnProbability = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (churnProbability >= 75) {
    riskLevel = 'critical';
  } else if (churnProbability >= 50) {
    riskLevel = 'high';
  } else if (churnProbability >= 25) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  // Determine risk window
  let estimatedRiskWindow: '30_days' | '60_days' | '90_days';
  if (churnProbability >= 70) {
    estimatedRiskWindow = '30_days';
  } else if (churnProbability >= 40) {
    estimatedRiskWindow = '60_days';
  } else {
    estimatedRiskWindow = '90_days';
  }

  // Generate recommended actions
  const recommendedActions: string[] = [];
  const highRiskFactors = riskFactors
    .filter(f => f.score >= 60)
    .sort((a, b) => b.score * b.weight - a.score * a.weight);

  for (const factor of highRiskFactors.slice(0, 3)) {
    switch (factor.factor) {
      case "Tendência do Health Score":
        recommendedActions.push("Agendar reunião de alinhamento estratégico urgente");
        break;
      case "NPS":
        recommendedActions.push("Realizar pesquisa qualitativa para entender insatisfação");
        break;
      case "Atingimento de Metas":
        recommendedActions.push("Revisar plano de ação e ajustar metas se necessário");
        break;
      case "Tarefas Atrasadas":
        recommendedActions.push("Fazer call de acompanhamento para destravar tarefas");
        break;
      case "Frequência de Reuniões":
        recommendedActions.push("Agendar reunião de acompanhamento imediatamente");
        break;
      case "Tickets de Suporte":
        recommendedActions.push("Priorizar resolução dos tickets abertos");
        break;
    }
  }

  if (recommendedActions.length === 0) {
    recommendedActions.push("Manter acompanhamento regular");
  }

  // Generate AI analysis
  const aiAnalysis = generateAIAnalysis(
    project,
    healthScore,
    riskFactors,
    churnProbability,
    riskLevel
  );

  // Calculate averages for storage
  const npsAvg = npsResponses && npsResponses.length > 0
    ? npsResponses.reduce((acc: number, r: any) => acc + r.score, 0) / npsResponses.length
    : null;

  // Upsert prediction
  const { data: prediction, error } = await supabase
    .from("churn_predictions")
    .upsert({
      project_id: projectId,
      prediction_date: new Date().toISOString().split('T')[0],
      churn_probability: Math.round(churnProbability * 100) / 100,
      risk_level: riskLevel,
      risk_factors: riskFactors,
      recommended_actions: recommendedActions,
      estimated_risk_window: estimatedRiskWindow,
      ai_analysis: aiAnalysis,
      health_score_at_prediction: healthScore?.total_score || null,
      nps_at_prediction: npsAvg,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'project_id,prediction_date'
    })
    .select()
    .single();

  if (error) {
    console.error("Error upserting prediction:", error);
    return null;
  }

  return {
    ...prediction,
    company_name: project.onboarding_companies?.name,
    product_name: project.product_name
  };
}

function generateAIAnalysis(
  project: any,
  healthScore: any,
  riskFactors: RiskFactor[],
  probability: number,
  riskLevel: string
): string {
  const companyName = project.onboarding_companies?.name || 'Cliente';
  const segment = project.onboarding_companies?.segment || 'não identificado';
  
  const highRisks = riskFactors.filter(f => f.score >= 60);
  const criticalRisks = riskFactors.filter(f => f.score >= 80);

  let analysis = `## Análise de Risco de Churn - ${companyName}\n\n`;
  analysis += `**Segmento:** ${segment}\n`;
  analysis += `**Probabilidade de Churn:** ${probability.toFixed(1)}% (${riskLevel.toUpperCase()})\n\n`;

  if (criticalRisks.length > 0) {
    analysis += `### ⚠️ Fatores Críticos\n`;
    for (const risk of criticalRisks) {
      analysis += `- **${risk.factor}:** ${risk.details}\n`;
    }
    analysis += '\n';
  }

  if (highRisks.length > 0 && highRisks.length > criticalRisks.length) {
    analysis += `### 🔶 Fatores de Atenção\n`;
    for (const risk of highRisks.filter(r => r.score < 80)) {
      analysis += `- **${risk.factor}:** ${risk.details}\n`;
    }
    analysis += '\n';
  }

  const lowRisks = riskFactors.filter(f => f.score < 30);
  if (lowRisks.length > 0) {
    analysis += `### ✅ Pontos Positivos\n`;
    for (const risk of lowRisks) {
      analysis += `- **${risk.factor}:** ${risk.details}\n`;
    }
    analysis += '\n';
  }

  if (probability >= 50) {
    analysis += `### 📋 Recomendação\n`;
    analysis += `Este cliente requer atenção imediata. Sugerimos uma abordagem proativa nos próximos dias para entender os problemas e propor soluções antes que a situação evolua para um cancelamento.`;
  } else if (probability >= 25) {
    analysis += `### 📋 Recomendação\n`;
    analysis += `Monitorar de perto os indicadores nas próximas semanas e manter comunicação ativa com o cliente.`;
  } else {
    analysis += `### 📋 Recomendação\n`;
    analysis += `Cliente com baixo risco. Manter o acompanhamento regular e buscar oportunidades de expansão.`;
  }

  return analysis;
}
