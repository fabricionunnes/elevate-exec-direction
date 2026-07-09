import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Mapeia IDs de campanha/conjunto/anúncio do Meta -> nome legível.
// Os leads guardam o ID (utm_campaign/utm_term/utm_content); o nome vive nas
// tabelas do módulo de tráfego (crm_meta_ads_*, sincronizadas do Meta).
// Cache em nível de módulo: busca uma vez só, compartilhado por todos os cards.

export interface MetaAdNames {
  campaigns: Record<string, string>;
  adsets: Record<string, string>;
  ads: Record<string, string>;
}

const EMPTY: MetaAdNames = { campaigns: {}, adsets: {}, ads: {} };

let cache: MetaAdNames | null = null;
let inflight: Promise<MetaAdNames> | null = null;

async function fetchNames(): Promise<MetaAdNames> {
  if (cache) return cache;
  const [c, s, a] = await Promise.all([
    supabase.from("crm_meta_ads_campaigns").select("campaign_id, campaign_name"),
    supabase.from("crm_meta_ads_adsets").select("adset_id, adset_name"),
    supabase.from("crm_meta_ads_ads").select("ad_id, ad_name"),
  ]);
  const result: MetaAdNames = { campaigns: {}, adsets: {}, ads: {} };
  (c.data || []).forEach((r: any) => {
    if (r.campaign_id && r.campaign_name) result.campaigns[r.campaign_id] = r.campaign_name;
  });
  (s.data || []).forEach((r: any) => {
    if (r.adset_id && r.adset_name) result.adsets[r.adset_id] = r.adset_name;
  });
  (a.data || []).forEach((r: any) => {
    if (r.ad_id && r.ad_name) result.ads[r.ad_id] = r.ad_name;
  });
  cache = result;
  return result;
}

export function useMetaAdNames(): MetaAdNames {
  const [names, setNames] = useState<MetaAdNames>(cache || EMPTY);
  useEffect(() => {
    if (cache) {
      setNames(cache);
      return;
    }
    let active = true;
    inflight = inflight || fetchNames();
    inflight
      .then((r) => { if (active) setNames(r); })
      .catch(() => { inflight = null; });
    return () => { active = false; };
  }, []);
  return names;
}
