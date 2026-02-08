import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeeklyReportData {
  bigNumbers: {
    mrr: number;
    mrrVariation: number;
    activeClients: number;
    clientsVariation: number;
    churnRate: number;
    churnVariation: number;
    nps: number;
    npsVariation: number;
  };
  mrrGained: number;
  mrrLost: number;
  churnedClients: { name: string; reason: string }[];
  atRiskClients: { name: string; healthScore: number; riskLevel: string }[];
  decisionsThisWeek: { title: string; area: string; status: string }[];
  decisionResults: { decision: string; result: string }[];
  criticalAlerts: { title: string; severity: string }[];
  aiRecommendations: { insight: string; category: string; status: string }[];
  nextWeekAgenda: { title: string; date: string }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { weekStart, weekEnd } = await req.json().catch(() => {
      // Default to current week if no dates provided
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      
      return {
        weekStart: monday.toISOString().split('T')[0],
        weekEnd: sunday.toISOString().split('T')[0]
      };
    });

    console.log(`Generating weekly report for ${weekStart} to ${weekEnd}`);

    // Previous week dates for comparison
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekEnd);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

    // Fetch all data in parallel
    const [
      projectsResult,
      healthScoresResult,
      npsResult,
      prevNpsResult,
      decisionsResult,
      decisionResultsData,
      alertsResult,
      aiRecsResult,
      agendaResult,
      churnedResult,
    ] = await Promise.all([
      // Active projects (current)
      supabase.from('onboarding_projects')
        .select('*, onboarding_companies(name, mrr, status)')
        .eq('status', 'active'),
      
      // Health scores
      supabase.from('client_health_scores')
        .select('*, onboarding_projects(id, product_name, onboarding_companies(name))')
        .lte('total_score', 50),
      
      // NPS this week
      supabase.from('onboarding_nps_responses')
        .select('score')
        .gte('created_at', weekStart)
        .lte('created_at', weekEnd + 'T23:59:59'),
      
      // NPS previous week
      supabase.from('onboarding_nps_responses')
        .select('score')
        .gte('created_at', prevWeekStart.toISOString().split('T')[0])
        .lte('created_at', prevWeekEnd.toISOString().split('T')[0] + 'T23:59:59'),
      
      // Decisions this week
      supabase.from('ceo_decisions')
        .select('*')
        .gte('created_at', weekStart)
        .lte('created_at', weekEnd + 'T23:59:59'),
      
      // Decision results this week
      supabase.from('ceo_decision_results')
        .select('*, ceo_decisions(title)')
        .gte('created_at', weekStart)
        .lte('created_at', weekEnd + 'T23:59:59'),
      
      // Alerts this week
      supabase.from('ceo_alerts')
        .select('*')
        .eq('is_dismissed', false)
        .gte('created_at', weekStart)
        .lte('created_at', weekEnd + 'T23:59:59'),
      
      // AI recommendations this week
      supabase.from('ceo_ai_recommendations')
        .select('*')
        .gte('created_at', weekStart)
        .lte('created_at', weekEnd + 'T23:59:59'),
      
      // Next week agenda (from Google Calendar would be ideal, using CEO agenda for now)
      supabase.from('ceo_agenda')
        .select('*')
        .gte('start_time', weekEnd)
        .order('start_time', { ascending: true })
        .limit(10),
      
      // Churned clients this week
      supabase.from('onboarding_companies')
        .select('name, churn_reason')
        .eq('status', 'churned')
        .gte('status_changed_at', weekStart)
        .lte('status_changed_at', weekEnd + 'T23:59:59'),
    ]);

    // Calculate Big Numbers
    const projects = projectsResult.data || [];
    const currentMRR = projects.reduce((sum, p) => sum + (p.onboarding_companies?.mrr || 0), 0);
    const activeClients = projects.length;
    
    // Calculate NPS
    const npsResponses = npsResult.data || [];
    const prevNpsResponses = prevNpsResult.data || [];
    
    const calculateNPS = (responses: { score: number }[]) => {
      if (responses.length === 0) return 0;
      const promoters = responses.filter(r => r.score >= 9).length;
      const detractors = responses.filter(r => r.score <= 6).length;
      return Math.round(((promoters - detractors) / responses.length) * 100);
    };
    
    const currentNPS = calculateNPS(npsResponses);
    const prevNPS = calculateNPS(prevNpsResponses);
    
    // Churned clients
    const churnedClients = churnedResult.data || [];
    const churnedMRR = 0; // Would need historical MRR data
    
    // At risk clients
    const atRiskClients = (healthScoresResult.data || []).map(hs => ({
      name: hs.onboarding_projects?.onboarding_companies?.name || hs.onboarding_projects?.product_name || 'Unknown',
      healthScore: hs.total_score,
      riskLevel: hs.risk_level || 'high'
    }));

    // Build report data
    const reportData: WeeklyReportData = {
      bigNumbers: {
        mrr: currentMRR,
        mrrVariation: 0, // Would need previous week MRR
        activeClients,
        clientsVariation: -churnedClients.length,
        churnRate: activeClients > 0 ? (churnedClients.length / activeClients) * 100 : 0,
        churnVariation: 0,
        nps: currentNPS,
        npsVariation: currentNPS - prevNPS,
      },
      mrrGained: 0, // Would need new client MRR
      mrrLost: churnedMRR,
      churnedClients: churnedClients.map(c => ({
        name: c.name,
        reason: c.churn_reason || 'Não informado'
      })),
      atRiskClients,
      decisionsThisWeek: (decisionsResult.data || []).map(d => ({
        title: d.title,
        area: d.area,
        status: d.status
      })),
      decisionResults: (decisionResultsData.data || []).map(dr => ({
        decision: dr.ceo_decisions?.title || 'Unknown',
        result: dr.result || 'Pendente'
      })),
      criticalAlerts: (alertsResult.data || [])
        .filter(a => a.severity === 'critical')
        .map(a => ({
          title: a.title,
          severity: a.severity
        })),
      aiRecommendations: (aiRecsResult.data || []).map(r => ({
        insight: r.insight,
        category: r.category,
        status: r.status
      })),
      nextWeekAgenda: (agendaResult.data || []).map(a => ({
        title: a.title,
        date: a.start_time
      }))
    };

    // Generate classification using AI
    const classificationPrompt = `
Analise os seguintes dados da semana e classifique como "good" (boa), "neutral" (neutra) ou "critical" (crítica).

Dados da Semana:
- MRR: R$ ${reportData.bigNumbers.mrr.toLocaleString('pt-BR')}
- Clientes Ativos: ${reportData.bigNumbers.activeClients}
- Clientes que saíram (churn): ${reportData.churnedClients.length}
- Clientes em risco: ${reportData.atRiskClients.length}
- NPS: ${reportData.bigNumbers.nps}
- Alertas críticos: ${reportData.criticalAlerts.length}
- Decisões tomadas: ${reportData.decisionsThisWeek.length}

Responda APENAS em formato JSON:
{
  "classification": "good" | "neutral" | "critical",
  "reason": "Justificativa em 1-2 frases"
}
`;

    let classification = 'neutral';
    let classificationReason = 'Semana dentro da normalidade operacional.';

    try {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Você é um CFO/COO experiente analisando dados semanais.' },
            { role: 'user', content: classificationPrompt }
          ],
          temperature: 0.3,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          classification = parsed.classification || 'neutral';
          classificationReason = parsed.reason || classificationReason;
        }
      }
    } catch (e) {
      console.error('AI classification error:', e);
    }

    // Check if report for this week already exists
    const { data: existingReport } = await supabase
      .from('ceo_weekly_reports')
      .select('id')
      .eq('week_start', weekStart)
      .single();

    let result;
    if (existingReport) {
      // Update existing report
      result = await supabase
        .from('ceo_weekly_reports')
        .update({
          report_data: reportData,
          classification,
          classification_reason: classificationReason,
          generated_at: new Date().toISOString(),
        })
        .eq('id', existingReport.id)
        .select()
        .single();
    } else {
      // Insert new report
      result = await supabase
        .from('ceo_weekly_reports')
        .insert({
          week_start: weekStart,
          week_end: weekEnd,
          report_data: reportData,
          classification,
          classification_reason: classificationReason,
        })
        .select()
        .single();
    }

    if (result.error) {
      throw result.error;
    }

    return new Response(
      JSON.stringify({ success: true, report: result.data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating weekly report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
