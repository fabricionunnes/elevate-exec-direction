import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LeadSummaryData {
  ai: any;
  lead: {
    id: string;
    name: string;
    company: string | null;
    segment: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    email: string | null;
    role: string | null;
    employee_count: string | null;
    main_pain: string | null;
    notes: string | null;
    origin: string | null;
    current_stage: string | null;
    stage_color: string | null;
    pipeline: string | null;
    owner: string | null;
    tags: { name: string; color: string }[];
    created_at: string;
    last_activity_at: string | null;
    days_in_funnel: number;
    opportunity_value: number | null;
    probability: number | null;
    trade_name: string | null;
  };
  journey: {
    stages: { id: string; name: string; color: string; sort_order: number; is_final: boolean; final_type: string | null }[];
    stage_changes: { from: string; to: string; date: string; staff: string | null }[];
    current_stage_id: string | null;
  };
  meetings: {
    total_realized: number;
    total_no_show: number;
    total_scheduled: number;
    total_rescheduled: number;
    events: { type: string; date: string; credited_to: string | null }[];
  };
  activities: {
    id: string;
    type: string;
    title: string;
    description: string | null;
    notes: string | null;
    status: string;
    scheduled_at: string | null;
    completed_at: string | null;
    responsible: string | null;
    created_at: string;
  }[];
  _generated_at?: string; // timestamp of when this summary was generated
}

export type SummaryTabType = "overview" | "guide" | "followup" | "analysis";

export function useLeadSummary(leadId: string) {
  const [overviewData, setOverviewData] = useState<LeadSummaryData | null>(null);
  const [guideData, setGuideData] = useState<LeadSummaryData | null>(null);
  const [followupData, setFollowupData] = useState<LeadSummaryData | null>(null);
  const [analysisData, setAnalysisData] = useState<LeadSummaryData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [loadingFollowup, setLoadingFollowup] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const lastKnownUpdatedAt = useRef<string | null>(null);
  const activeTab = useRef<SummaryTabType | null>(null);

  const setActiveTab = useCallback((tab: SummaryTabType) => {
    activeTab.current = tab;
  }, []);

  const setDataForType = useCallback((type: SummaryTabType, data: LeadSummaryData | null) => {
    const setters: Record<SummaryTabType, (d: LeadSummaryData | null) => void> = {
      overview: setOverviewData, guide: setGuideData, followup: setFollowupData, analysis: setAnalysisData,
    };
    setters[type](data);
  }, []);

  const setLoadingForType = useCallback((type: SummaryTabType, loading: boolean) => {
    const setters: Record<SummaryTabType, (l: boolean) => void> = {
      overview: setLoadingOverview, guide: setLoadingGuide, followup: setLoadingFollowup, analysis: setLoadingAnalysis,
    };
    setters[type](loading);
  }, []);

  // Load saved summaries from database on mount
  useEffect(() => {
    const loadSaved = async () => {
      try {
        const { data: saved } = await supabase
          .from("crm_lead_summaries")
          .select("summary_type, summary_data, generated_at")
          .eq("lead_id", leadId);

        if (saved && saved.length > 0) {
          for (const row of saved) {
            const enriched = { ...row.summary_data as any, _generated_at: row.generated_at };
            setDataForType(row.summary_type as SummaryTabType, enriched);
          }
        }
      } catch (err) {
        console.error("Error loading saved summaries:", err);
      } finally {
        setInitialLoadDone(true);
      }
    };
    loadSaved();
  }, [leadId, setDataForType]);

  const fetchSummary = useCallback(async (type: SummaryTabType, force = false, extra?: Record<string, any>) => {
    // Wait for saved data to load before deciding to fetch from AI
    if (!initialLoadDone && !force) return;
    
    const dataMap = { overview: overviewData, guide: guideData, followup: followupData, analysis: analysisData };
    const current = dataMap[type];
    if (current && !force) return;

    setLoadingForType(type, true);
    try {
      const { data, error } = await supabase.functions.invoke("lead-summary", {
        body: { leadId, type, ...extra },
      });
      if (error) throw error;
      const enrichedData = { ...data, _generated_at: new Date().toISOString() };
      setDataForType(type, enrichedData);
    } catch (err: any) {
      console.error(`Error fetching ${type} summary:`, err);
      const labels: Record<string, string> = { overview: "visão geral", guide: "guia de atendimento", followup: "follow up", analysis: "análise" };
      toast.error(`Erro ao gerar ${labels[type]}`);
    } finally {
      setLoadingForType(type, false);
    }
  }, [leadId, initialLoadDone, overviewData, guideData, followupData, analysisData, setDataForType, setLoadingForType]);

  // Auto-refresh: listen to lead changes via realtime or polling
  useEffect(() => {
    // Check for changes every 30 seconds when data is loaded
    const interval = setInterval(async () => {
      // Only check if we have data loaded
      if (!overviewData && !guideData && !followupData && !analysisData) return;

      try {
        const { data: lead } = await supabase
          .from("crm_leads")
          .select("updated_at, last_activity_at")
          .eq("id", leadId)
          .single();

        if (!lead) return;

        const currentTimestamp = lead.updated_at || lead.last_activity_at;
        if (!currentTimestamp) return;

        // If first check, just store the timestamp
        if (!lastKnownUpdatedAt.current) {
          lastKnownUpdatedAt.current = currentTimestamp;
          return;
        }

        // If timestamp changed, invalidate cached data
        if (currentTimestamp !== lastKnownUpdatedAt.current) {
          lastKnownUpdatedAt.current = currentTimestamp;
          
          setOverviewData(null);
          setGuideData(null);
          setFollowupData(null);
          setAnalysisData(null);

          // Auto-regenerate the active tab
          const tab = activeTab.current;
          if (tab) {
            toast.info("Dados do lead atualizados. Regenerando resumo...");
            // Small delay to let state clear
            setTimeout(() => fetchSummary(tab, true), 300);
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [leadId, overviewData, guideData, followupData, analysisData, fetchSummary]);

  return {
    overviewData,
    guideData,
    followupData,
    analysisData,
    loadingOverview,
    loadingGuide,
    loadingFollowup,
    loadingAnalysis,
    initialLoadDone,
    setActiveTab,
    fetchOverview: (force?: boolean) => fetchSummary("overview", force),
    fetchGuide: (force?: boolean) => fetchSummary("guide", force),
    fetchFollowup: (force?: boolean) => fetchSummary("followup", force),
    fetchAnalysis: (force?: boolean, transcriptionId?: string) => fetchSummary("analysis", force, transcriptionId ? { transcriptionId } : undefined),
  };
}
