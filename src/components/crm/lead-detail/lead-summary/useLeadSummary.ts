import { useState, useCallback } from "react";
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
}

export function useLeadSummary(leadId: string) {
  const [overviewData, setOverviewData] = useState<LeadSummaryData | null>(null);
  const [guideData, setGuideData] = useState<LeadSummaryData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingGuide, setLoadingGuide] = useState(false);

  const fetchSummary = useCallback(async (type: "overview" | "guide", force = false) => {
    const isOverview = type === "overview";
    const current = isOverview ? overviewData : guideData;
    if (current && !force) return;

    const setLoading = isOverview ? setLoadingOverview : setLoadingGuide;
    const setData = isOverview ? setOverviewData : setGuideData;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("lead-summary", {
        body: { leadId, type },
      });
      if (error) throw error;
      setData(data);
    } catch (err: any) {
      console.error(`Error fetching ${type} summary:`, err);
      toast.error(`Erro ao gerar ${isOverview ? "visão geral" : "guia de atendimento"}`);
    } finally {
      setLoading(false);
    }
  }, [leadId, overviewData, guideData]);

  return {
    overviewData,
    guideData,
    loadingOverview,
    loadingGuide,
    fetchOverview: (force?: boolean) => fetchSummary("overview", force),
    fetchGuide: (force?: boolean) => fetchSummary("guide", force),
  };
}
