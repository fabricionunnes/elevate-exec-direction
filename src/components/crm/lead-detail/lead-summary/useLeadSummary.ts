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

export type SummaryTabType = "overview" | "guide" | "followup";

export function useLeadSummary(leadId: string) {
  const [overviewData, setOverviewData] = useState<LeadSummaryData | null>(null);
  const [guideData, setGuideData] = useState<LeadSummaryData | null>(null);
  const [followupData, setFollowupData] = useState<LeadSummaryData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [loadingFollowup, setLoadingFollowup] = useState(false);
  const lastKnownUpdatedAt = useRef<string | null>(null);
  const activeTab = useRef<SummaryTabType | null>(null);

  const setActiveTab = useCallback((tab: SummaryTabType) => {
    activeTab.current = tab;
  }, []);

  const fetchSummary = useCallback(async (type: SummaryTabType, force = false) => {
    const dataMap = { overview: overviewData, guide: guideData, followup: followupData };
    const current = dataMap[type];
    if (current && !force) return;

    const setLoading = type === "overview" ? setLoadingOverview : type === "guide" ? setLoadingGuide : setLoadingFollowup;
    const setData = type === "overview" ? setOverviewData : type === "guide" ? setGuideData : setFollowupData;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("lead-summary", {
        body: { leadId, type },
      });
      if (error) throw error;
      const enrichedData = { ...data, _generated_at: new Date().toISOString() };
      setData(enrichedData);
    } catch (err: any) {
      console.error(`Error fetching ${type} summary:`, err);
      const labels: Record<string, string> = { overview: "visão geral", guide: "guia de atendimento", followup: "follow up" };
      toast.error(`Erro ao gerar ${labels[type]}`);
    } finally {
      setLoading(false);
    }
  }, [leadId, overviewData, guideData, followupData]);

  // Auto-refresh: listen to lead changes via realtime or polling
  useEffect(() => {
    // Check for changes every 30 seconds when data is loaded
    const interval = setInterval(async () => {
      // Only check if we have data loaded
      if (!overviewData && !guideData && !followupData) return;

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
  }, [leadId, overviewData, guideData, followupData, fetchSummary]);

  return {
    overviewData,
    guideData,
    followupData,
    loadingOverview,
    loadingGuide,
    loadingFollowup,
    setActiveTab,
    fetchOverview: (force?: boolean) => fetchSummary("overview", force),
    fetchGuide: (force?: boolean) => fetchSummary("guide", force),
    fetchFollowup: (force?: boolean) => fetchSummary("followup", force),
  };
}
