import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID");
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GRAPH_API = "https://graph.facebook.com/v21.0";

async function fetchWithTimeout(url: string, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, project_id, code, redirect_uri, date_start, date_stop } = body;

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
      throw new Error("Facebook App credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // ──── GET AUTH URL ────
    if (action === "auth_url") {
      const scopes = "ads_read,ads_management,business_management";
      const state = btoa(JSON.stringify({ project_id, flow: "meta_ads", redirect_uri }));
      const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${scopes}&state=${encodeURIComponent(state)}&response_type=code`;
      
      return new Response(JSON.stringify({ url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──── EXCHANGE CODE FOR TOKEN ────
    if (action === "connect") {
      const { oauth_state } = body;

      let stateRedirectUri: string | undefined;
      if (oauth_state) {
        try {
          const decodedState = JSON.parse(atob(oauth_state));
          stateRedirectUri = decodedState?.redirect_uri;
        } catch {
          // ignore invalid state decoding and fallback to provided redirect_uri
        }
      }

      // Facebook is strict with redirect_uri matching; try both normalized variants
      const redirectCandidates = Array.from(
        new Set(
          [redirect_uri, stateRedirectUri]
            .filter(Boolean)
            .flatMap((uri) => {
              const base = String(uri).trim().replace(/\/+$/, "");
              return base ? [base, `${base}/`] : [];
            })
        )
      );

      if (redirectCandidates.length === 0) {
        throw new Error("redirect_uri não informado");
      }

      let tokenData: any = null;
      let tokenErrorMessage = "Erro ao validar código OAuth";

      for (const candidateRedirectUri of redirectCandidates) {
        const tokenUrl = `${GRAPH_API}/oauth/access_token?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(candidateRedirectUri)}&client_secret=${FACEBOOK_APP_SECRET}&code=${code}`;
        const tokenRes = await fetchWithTimeout(tokenUrl);
        const candidateTokenData = await tokenRes.json();

        if (!candidateTokenData.error && candidateTokenData.access_token) {
          tokenData = candidateTokenData;
          break;
        }

        tokenErrorMessage = candidateTokenData?.error?.message || tokenErrorMessage;
      }

      if (!tokenData?.access_token) {
        throw new Error(tokenErrorMessage);
      }

      // Exchange for long-lived token
      const longUrl = `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`;
      const longRes = await fetchWithTimeout(longUrl);
      const longData = await longRes.json();
      if (longData.error) throw new Error(longData.error.message);
      const longToken = longData.access_token;

      // Get ad accounts
      const accountsRes = await fetchWithTimeout(`${GRAPH_API}/me/adaccounts?fields=id,name,account_id,account_status,currency,timezone_name&access_token=${longToken}`);
      const accountsData = await accountsRes.json();
      if (accountsData.error) throw new Error(accountsData.error.message);

      const accounts = (accountsData.data || []).map((acc: any) => ({
        id: acc.id,
        account_id: acc.account_id,
        name: acc.name,
        status: acc.account_status,
        currency: acc.currency,
      }));

      return new Response(JSON.stringify({ accounts, access_token: longToken }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──── SAVE ACCOUNT CONNECTION ────
    if (action === "save_connection") {
      const { ad_account_id, ad_account_name, access_token, user_id } = body;

      const { error } = await supabase.from("meta_ads_accounts").upsert({
        project_id,
        ad_account_id,
        ad_account_name,
        access_token,
        is_connected: true,
        connected_by: user_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "project_id,ad_account_id" });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──── SYNC DATA ────
    if (action === "sync") {
      // Get account connection
      const { data: account, error: accErr } = await supabase
        .from("meta_ads_accounts")
        .select("*")
        .eq("project_id", project_id)
        .eq("is_connected", true)
        .single();

      if (accErr || !account) throw new Error("No Meta Ads account connected");

      const token = account.access_token;
      const adAccountId = account.ad_account_id.startsWith("act_") ? account.ad_account_id : `act_${account.ad_account_id}`;

      // Default date range: last 30 days
      const end = date_stop || new Date().toISOString().split("T")[0];
      const start = date_start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const insightFields = "impressions,reach,clicks,spend,cpc,cpm,ctr,actions,action_values,frequency";

      // ── Fetch Campaigns ──
      const campaignsUrl = `${GRAPH_API}/${adAccountId}/campaigns?fields=name,status,objective,daily_budget,lifetime_budget,insights.time_range({"since":"${start}","until":"${end}"}).fields(${insightFields})&limit=100&access_token=${token}`;
      const campaignsRes = await fetchWithTimeout(campaignsUrl, 60000);
      const campaignsData = await campaignsRes.json();
      if (campaignsData.error) throw new Error(`Campaigns: ${campaignsData.error.message}`);

      const campaigns = (campaignsData.data || []).map((c: any) => {
        const ins = c.insights?.data?.[0] || {};
        const conversions = (ins.actions || []).find((a: any) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase")?.value || 0;
        const convValue = (ins.action_values || []).find((a: any) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase")?.value || 0;
        return {
          project_id,
          campaign_id: c.id,
          campaign_name: c.name,
          status: c.status,
          objective: c.objective,
          daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
          lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
          impressions: Number(ins.impressions || 0),
          reach: Number(ins.reach || 0),
          clicks: Number(ins.clicks || 0),
          spend: Number(ins.spend || 0),
          cpc: Number(ins.cpc || 0),
          cpm: Number(ins.cpm || 0),
          ctr: Number(ins.ctr || 0),
          conversions: Number(conversions),
          conversion_value: Number(convValue),
          roas: Number(ins.spend) > 0 ? Number(convValue) / Number(ins.spend) : 0,
          frequency: Number(ins.frequency || 0),
          date_start: start,
          date_stop: end,
          synced_at: new Date().toISOString(),
        };
      });

      // ── Fetch AdSets ──
      const adsetsUrl = `${GRAPH_API}/${adAccountId}/adsets?fields=name,status,campaign_id,campaign{name},daily_budget,insights.time_range({"since":"${start}","until":"${end}"}).fields(${insightFields})&limit=200&access_token=${token}`;
      const adsetsRes = await fetchWithTimeout(adsetsUrl, 60000);
      const adsetsData = await adsetsRes.json();
      if (adsetsData.error) throw new Error(`AdSets: ${adsetsData.error.message}`);

      const adsets = (adsetsData.data || []).map((a: any) => {
        const ins = a.insights?.data?.[0] || {};
        const conversions = (ins.actions || []).find((act: any) => act.action_type === "purchase")?.value || 0;
        const convValue = (ins.action_values || []).find((act: any) => act.action_type === "purchase")?.value || 0;
        return {
          project_id,
          adset_id: a.id,
          adset_name: a.name,
          campaign_id: a.campaign_id,
          campaign_name: a.campaign?.name || null,
          status: a.status,
          daily_budget: a.daily_budget ? Number(a.daily_budget) / 100 : null,
          impressions: Number(ins.impressions || 0),
          reach: Number(ins.reach || 0),
          clicks: Number(ins.clicks || 0),
          spend: Number(ins.spend || 0),
          cpc: Number(ins.cpc || 0),
          cpm: Number(ins.cpm || 0),
          ctr: Number(ins.ctr || 0),
          conversions: Number(conversions),
          conversion_value: Number(convValue),
          roas: Number(ins.spend) > 0 ? Number(convValue) / Number(ins.spend) : 0,
          frequency: Number(ins.frequency || 0),
          date_start: start,
          date_stop: end,
          synced_at: new Date().toISOString(),
        };
      });

      // ── Fetch Ads ──
      const adsUrl = `${GRAPH_API}/${adAccountId}/ads?fields=name,status,adset_id,adset{name},campaign_id,campaign{name},creative{thumbnail_url,body,title,image_url,object_story_spec},insights.time_range({"since":"${start}","until":"${end}"}).fields(${insightFields})&limit=200&access_token=${token}`;
      const adsRes = await fetchWithTimeout(adsUrl, 60000);
      const adsData = await adsRes.json();
      if (adsData.error) throw new Error(`Ads: ${adsData.error.message}`);

      const ads = (adsData.data || []).map((ad: any) => {
        const ins = ad.insights?.data?.[0] || {};
        const creative = ad.creative || {};
        const conversions = (ins.actions || []).find((act: any) => act.action_type === "purchase")?.value || 0;
        const convValue = (ins.action_values || []).find((act: any) => act.action_type === "purchase")?.value || 0;
        return {
          project_id,
          ad_id: ad.id,
          ad_name: ad.name,
          adset_id: ad.adset_id,
          adset_name: ad.adset?.name || null,
          campaign_id: ad.campaign_id,
          campaign_name: ad.campaign?.name || null,
          status: ad.status,
          creative_thumbnail_url: creative.thumbnail_url || null,
          creative_body: creative.body || null,
          creative_title: creative.title || null,
          creative_link_url: creative.object_story_spec?.link_data?.link || null,
          impressions: Number(ins.impressions || 0),
          reach: Number(ins.reach || 0),
          clicks: Number(ins.clicks || 0),
          spend: Number(ins.spend || 0),
          cpc: Number(ins.cpc || 0),
          cpm: Number(ins.cpm || 0),
          ctr: Number(ins.ctr || 0),
          conversions: Number(conversions),
          conversion_value: Number(convValue),
          roas: Number(ins.spend) > 0 ? Number(convValue) / Number(ins.spend) : 0,
          frequency: Number(ins.frequency || 0),
          date_start: start,
          date_stop: end,
          synced_at: new Date().toISOString(),
        };
      });

      // ── Upsert data ──
      // Clear old data for this date range first
      await supabase.from("meta_ads_campaigns").delete().eq("project_id", project_id).eq("date_start", start).eq("date_stop", end);
      await supabase.from("meta_ads_adsets").delete().eq("project_id", project_id).eq("date_start", start).eq("date_stop", end);
      await supabase.from("meta_ads_ads").delete().eq("project_id", project_id).eq("date_start", start).eq("date_stop", end);

      if (campaigns.length > 0) await supabase.from("meta_ads_campaigns").insert(campaigns);
      if (adsets.length > 0) await supabase.from("meta_ads_adsets").insert(adsets);
      if (ads.length > 0) await supabase.from("meta_ads_ads").insert(ads);

      return new Response(JSON.stringify({
        success: true,
        synced: { campaigns: campaigns.length, adsets: adsets.length, ads: ads.length },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──── DISCONNECT ────
    if (action === "disconnect") {
      await supabase.from("meta_ads_accounts").update({ is_connected: false }).eq("project_id", project_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: any) {
    console.error("Meta Ads Sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
