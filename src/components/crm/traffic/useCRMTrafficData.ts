import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CRMMetaAccount {
  id: string;
  ad_account_id: string;
  ad_account_name: string | null;
  is_connected: boolean;
  last_synced_at: string | null;
  tenant_id: string | null;
}

export interface CRMMetaCampaign {
  id: string;
  campaign_id: string;
  campaign_name: string | null;
  status: string | null;
  objective: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
  leads: number;
  conversions: number;
  conversion_value: number;
  date_start: string | null;
  date_stop: string | null;
}

export interface CRMMetaAdset {
  id: string;
  adset_id: string;
  adset_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  status: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  conversions: number;
}

export interface CRMMetaAd {
  id: string;
  ad_id: string;
  ad_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  status: string | null;
  creative_thumbnail_url: string | null;
  creative_title: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  conversions: number;
}

export interface CampaignPipelineLink {
  id: string;
  account_id: string;
  campaign_id: string;
  pipeline_id: string;
  weight: number;
  pipeline_name?: string;
}

export interface PipelineLeadCount {
  pipeline_id: string;
  utm_campaign: string | null;
  date: string | null; // YYYY-MM-DD (created_at do lead)
  total: number;
  won: number;
  won_value: number;
}

export interface MeetingStat {
  pipeline_id: string;
  utm_campaign: string | null;
  date: string | null; // YYYY-MM-DD (event_date)
  scheduled: number;
  realized: number;
}

export function useCRMTrafficData() {
  const [account, setAccount] = useState<CRMMetaAccount | null>(null);
  const [campaigns, setCampaigns] = useState<CRMMetaCampaign[]>([]);
  const [adsets, setAdsets] = useState<CRMMetaAdset[]>([]);
  const [ads, setAds] = useState<CRMMetaAd[]>([]);
  const [links, setLinks] = useState<CampaignPipelineLink[]>([]);
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [leadStats, setLeadStats] = useState<PipelineLeadCount[]>([]);
  const [meetingStats, setMeetingStats] = useState<MeetingStat[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data: accData } = await supabase
        .from("crm_meta_ads_accounts")
        .select("*")
        .eq("is_connected", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setAccount(accData as any);

      // Pipelines (sempre carrega para o gerenciador de vínculos)
      const { data: pipes } = await supabase
        .from("crm_pipelines")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order");
      setPipelines((pipes as any) || []);

      if (!accData) {
        setCampaigns([]); setAdsets([]); setAds([]); setLinks([]); setLeadStats([]); setMeetingStats([]);
        return;
      }

      const [{ data: c }, { data: a }, { data: ad }, { data: l }] = await Promise.all([
        supabase
          .from("crm_meta_ads_campaigns")
          .select("*")
          .eq("account_id", accData.id)
          .order("spend", { ascending: false }),
        supabase
          .from("crm_meta_ads_adsets")
          .select("*")
          .eq("account_id", accData.id)
          .order("spend", { ascending: false }),
        supabase
          .from("crm_meta_ads_ads")
          .select("*")
          .eq("account_id", accData.id)
          .order("spend", { ascending: false }),
        supabase
          .from("crm_meta_campaign_pipelines")
          .select("*, pipeline:crm_pipelines(name)")
          .eq("account_id", accData.id),
      ]);

      setCampaigns((c as any) || []);
      setAdsets((a as any) || []);
      setAds((ad as any) || []);
      setLinks(
        ((l as any) || []).map((x: any) => ({
          ...x,
          pipeline_name: x.pipeline?.name,
        })),
      );

      // Estatísticas de leads/vendas por funil (+ utm_campaign quando existir)
      const { data: leads } = await supabase
        .from("crm_leads")
        .select("pipeline_id, utm_campaign, opportunity_value, crm_stages(final_type)");

      const map = new Map<string, PipelineLeadCount>();
      for (const lead of (leads as any) || []) {
        if (!lead.pipeline_id) continue;
        const utm = lead.utm_campaign || null;
        const key = `${lead.pipeline_id}::${utm || "__none__"}`;
        const isWon = lead.crm_stages?.final_type === "won";
        const cur = map.get(key) || {
          pipeline_id: lead.pipeline_id,
          utm_campaign: utm,
          total: 0,
          won: 0,
          won_value: 0,
        };
        cur.total += 1;
        if (isWon) {
          cur.won += 1;
          cur.won_value += Number(lead.opportunity_value || 0);
        }
        map.set(key, cur);
      }
      setLeadStats(Array.from(map.values()));

      // Estatísticas de reuniões (agendadas / realizadas) por funil (+ utm_campaign do lead)
      const { data: meetings } = await supabase
        .from("crm_meeting_events")
        .select("event_type, pipeline_id, lead:crm_leads(utm_campaign)")
        .in("event_type", ["scheduled", "realized"]);

      const mMap = new Map<string, MeetingStat>();
      for (const ev of (meetings as any) || []) {
        const utm = ev.lead?.utm_campaign || null;
        if (!ev.pipeline_id) continue;
        const key = `${ev.pipeline_id}::${utm || "__none__"}`;
        const cur = mMap.get(key) || {
          pipeline_id: ev.pipeline_id,
          utm_campaign: utm,
          scheduled: 0,
          realized: 0,
        };
        if (ev.event_type === "scheduled") cur.scheduled += 1;
        else if (ev.event_type === "realized") cur.realized += 1;
        mMap.set(key, cur);
      }
      setMeetingStats(Array.from(mMap.values()));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    account,
    campaigns,
    adsets,
    ads,
    links,
    pipelines,
    leadStats,
    meetingStats,
    loading,
    reload,
  };
}
