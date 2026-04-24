// CRM Meta Ads Sync — escopado por tenant (CRM Comercial)
// Reaproveita as credenciais FACEBOOK_APP_ID/SECRET já configuradas no projeto.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID");
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GRAPH_API = "https://graph.facebook.com/v21.0";
const STABLE_REDIRECT_URI = "https://elevate-exec-direction.lovable.app/meta-ads-callback";

const SCOPES = [
  "ads_read",
  "ads_management",
  "business_management",
  "read_insights",
  "pages_read_engagement",
  "pages_show_list",
];

async function gj(url: string) {
  const res = await fetch(url);
  return await res.json();
}

function todayRangeISO(days = 30) {
  const stop = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { since: iso(start), until: iso(stop) };
}

function num(v: any, def = 0) {
  const n = Number(v);
  return isFinite(n) ? n : def;
}

function extractActionValue(actions: any[] | undefined, types: string[]): number {
  if (!actions) return 0;
  let total = 0;
  for (const a of actions) {
    if (types.includes(a.action_type)) total += num(a.value);
  }
  return total;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ---------------- AUTH URL ----------------
    if (action === "auth_url") {
      const { tenant_id, redirect_uri, return_origin } = body;
      const state = btoa(JSON.stringify({ tenant_id: tenant_id ?? null, redirect_uri, return_origin }));
      const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
      url.searchParams.set("client_id", FACEBOOK_APP_ID || "");
      url.searchParams.set("redirect_uri", redirect_uri || STABLE_REDIRECT_URI);
      url.searchParams.set("scope", SCOPES.join(","));
      url.searchParams.set("response_type", "code");
      url.searchParams.set("state", state);
      return new Response(JSON.stringify({ url: url.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------------- CONNECT (exchange code → list ad accounts) ----------------
    if (action === "connect") {
      const { code, redirect_uri } = body;
      if (!code) throw new Error("code obrigatório");
      const tokenUrl = new URL(`${GRAPH_API}/oauth/access_token`);
      tokenUrl.searchParams.set("client_id", FACEBOOK_APP_ID || "");
      tokenUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET || "");
      tokenUrl.searchParams.set("redirect_uri", redirect_uri || STABLE_REDIRECT_URI);
      tokenUrl.searchParams.set("code", code);
      const tokRes = await gj(tokenUrl.toString());
      if (tokRes.error) throw new Error(tokRes.error.message || "OAuth falhou");
      const shortToken = tokRes.access_token;

      // Long-lived token
      const longUrl = new URL(`${GRAPH_API}/oauth/access_token`);
      longUrl.searchParams.set("grant_type", "fb_exchange_token");
      longUrl.searchParams.set("client_id", FACEBOOK_APP_ID || "");
      longUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET || "");
      longUrl.searchParams.set("fb_exchange_token", shortToken);
      const longRes = await gj(longUrl.toString());
      const accessToken = longRes.access_token || shortToken;
      const expiresIn = Number(longRes.expires_in || 0);
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

      // List ad accounts
      const accRes = await gj(
        `${GRAPH_API}/me/adaccounts?fields=id,account_id,name,currency,account_status&limit=200&access_token=${accessToken}`,
      );
      if (accRes.error) throw new Error(accRes.error.message);

      return new Response(
        JSON.stringify({
          access_token: accessToken,
          expires_at: expiresAt,
          accounts: accRes.data || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---------------- SAVE CONNECTION ----------------
    if (action === "save_connection") {
      const { tenant_id, ad_account_id, ad_account_name, access_token, expires_at, user_id } = body;
      if (!ad_account_id || !access_token) throw new Error("ad_account_id e access_token obrigatórios");

      // Desativa qualquer outra conta deste tenant
      await supabase
        .from("crm_meta_ads_accounts")
        .update({ is_connected: false })
        .match(tenant_id ? { tenant_id, is_connected: true } : { is_connected: true });

      const { data, error } = await supabase
        .from("crm_meta_ads_accounts")
        .upsert(
          {
            tenant_id: tenant_id ?? null,
            ad_account_id,
            ad_account_name,
            access_token,
            token_expires_at: expires_at,
            is_connected: true,
            connected_by: user_id ?? null,
          },
          { onConflict: "tenant_id,ad_account_id" },
        )
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, account: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------------- DISCONNECT ----------------
    if (action === "disconnect") {
      const { account_id } = body;
      const { error } = await supabase
        .from("crm_meta_ads_accounts")
        .update({ is_connected: false })
        .eq("id", account_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------------- SYNC (campaigns + adsets + ads + insights) ----------------
    if (action === "sync") {
      const { account_id, days } = body;
      if (!account_id) throw new Error("account_id obrigatório");

      const { data: acc, error: accErr } = await supabase
        .from("crm_meta_ads_accounts")
        .select("*")
        .eq("id", account_id)
        .single();
      if (accErr || !acc) throw new Error("Conta não encontrada");

      const token = acc.access_token;
      const fbAccount = acc.ad_account_id; // formato: act_XXX
      const range = todayRangeISO(days || 30);
      const timeRange = encodeURIComponent(JSON.stringify(range));

      const insightFields =
        "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,reach,clicks,spend,cpc,cpm,ctr,frequency,actions,action_values";

      // ---- CAMPAIGNS metadata ----
      const campMetaRes = await gj(
        `${GRAPH_API}/${fbAccount}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=500&access_token=${token}`,
      );
      const campsMeta: Record<string, any> = {};
      for (const c of campMetaRes.data || []) campsMeta[c.id] = c;

      // ---- CAMPAIGN insights ----
      const campInsRes = await gj(
        `${GRAPH_API}/${fbAccount}/insights?level=campaign&fields=${insightFields}&time_range=${timeRange}&limit=500&access_token=${token}`,
      );
      const campaignsRows: any[] = [];
      for (const ins of campInsRes.data || []) {
        const meta = campsMeta[ins.campaign_id] || {};
        const leads = extractActionValue(ins.actions, [
          "lead",
          "onsite_conversion.lead_grouped",
          "offsite_conversion.fb_pixel_lead",
        ]);
        const conversions = extractActionValue(ins.actions, [
          "purchase",
          "offsite_conversion.fb_pixel_purchase",
          "onsite_conversion.purchase",
          "complete_registration",
        ]);
        const conversion_value = extractActionValue(ins.action_values, [
          "purchase",
          "offsite_conversion.fb_pixel_purchase",
          "onsite_conversion.purchase",
        ]);
        campaignsRows.push({
          tenant_id: acc.tenant_id,
          account_id: acc.id,
          campaign_id: ins.campaign_id,
          campaign_name: ins.campaign_name || meta.name,
          status: meta.status,
          objective: meta.objective,
          daily_budget: meta.daily_budget ? num(meta.daily_budget) / 100 : null,
          lifetime_budget: meta.lifetime_budget ? num(meta.lifetime_budget) / 100 : null,
          impressions: num(ins.impressions),
          reach: num(ins.reach),
          clicks: num(ins.clicks),
          spend: num(ins.spend),
          cpc: num(ins.cpc),
          cpm: num(ins.cpm),
          ctr: num(ins.ctr),
          frequency: num(ins.frequency),
          leads,
          conversions,
          conversion_value,
          date_start: range.since,
          date_stop: range.until,
          synced_at: new Date().toISOString(),
        });
      }
      if (campaignsRows.length) {
        await supabase
          .from("crm_meta_ads_campaigns")
          .upsert(campaignsRows, { onConflict: "account_id,campaign_id,date_start,date_stop" });
      }

      // ---- ADSETS ----
      const adsetMetaRes = await gj(
        `${GRAPH_API}/${fbAccount}/adsets?fields=id,name,status,daily_budget,campaign_id&limit=1000&access_token=${token}`,
      );
      const adsetsMeta: Record<string, any> = {};
      for (const a of adsetMetaRes.data || []) adsetsMeta[a.id] = a;

      const adsetInsRes = await gj(
        `${GRAPH_API}/${fbAccount}/insights?level=adset&fields=${insightFields}&time_range=${timeRange}&limit=1000&access_token=${token}`,
      );
      const adsetRows: any[] = [];
      for (const ins of adsetInsRes.data || []) {
        const meta = adsetsMeta[ins.adset_id] || {};
        const leads = extractActionValue(ins.actions, [
          "lead",
          "onsite_conversion.lead_grouped",
          "offsite_conversion.fb_pixel_lead",
        ]);
        const conversions = extractActionValue(ins.actions, [
          "purchase",
          "offsite_conversion.fb_pixel_purchase",
          "complete_registration",
        ]);
        adsetRows.push({
          tenant_id: acc.tenant_id,
          account_id: acc.id,
          adset_id: ins.adset_id,
          adset_name: ins.adset_name || meta.name,
          campaign_id: ins.campaign_id,
          campaign_name: ins.campaign_name,
          status: meta.status,
          daily_budget: meta.daily_budget ? num(meta.daily_budget) / 100 : null,
          impressions: num(ins.impressions),
          reach: num(ins.reach),
          clicks: num(ins.clicks),
          spend: num(ins.spend),
          cpc: num(ins.cpc),
          cpm: num(ins.cpm),
          ctr: num(ins.ctr),
          frequency: num(ins.frequency),
          leads,
          conversions,
          date_start: range.since,
          date_stop: range.until,
          synced_at: new Date().toISOString(),
        });
      }
      if (adsetRows.length) {
        await supabase
          .from("crm_meta_ads_adsets")
          .upsert(adsetRows, { onConflict: "account_id,adset_id,date_start,date_stop" });
      }

      // ---- ADS (criativos) ----
      const adMetaRes = await gj(
        `${GRAPH_API}/${fbAccount}/ads?fields=id,name,status,creative{thumbnail_url,body,title,object_story_spec,effective_object_story_id}&limit=1000&access_token=${token}`,
      );
      const adsMeta: Record<string, any> = {};
      for (const a of adMetaRes.data || []) adsMeta[a.id] = a;

      const adInsRes = await gj(
        `${GRAPH_API}/${fbAccount}/insights?level=ad&fields=${insightFields}&time_range=${timeRange}&limit=1000&access_token=${token}`,
      );
      const adRows: any[] = [];
      for (const ins of adInsRes.data || []) {
        const meta = adsMeta[ins.ad_id] || {};
        const cr = meta.creative || {};
        const leads = extractActionValue(ins.actions, [
          "lead",
          "onsite_conversion.lead_grouped",
          "offsite_conversion.fb_pixel_lead",
        ]);
        const conversions = extractActionValue(ins.actions, [
          "purchase",
          "offsite_conversion.fb_pixel_purchase",
        ]);
        adRows.push({
          tenant_id: acc.tenant_id,
          account_id: acc.id,
          ad_id: ins.ad_id,
          ad_name: ins.ad_name || meta.name,
          adset_id: ins.adset_id,
          adset_name: ins.adset_name,
          campaign_id: ins.campaign_id,
          campaign_name: ins.campaign_name,
          status: meta.status,
          creative_thumbnail_url: cr.thumbnail_url || null,
          creative_body: cr.body || null,
          creative_title: cr.title || null,
          creative_link_url: cr.object_story_spec?.link_data?.link || null,
          impressions: num(ins.impressions),
          reach: num(ins.reach),
          clicks: num(ins.clicks),
          spend: num(ins.spend),
          cpc: num(ins.cpc),
          cpm: num(ins.cpm),
          ctr: num(ins.ctr),
          frequency: num(ins.frequency),
          leads,
          conversions,
          date_start: range.since,
          date_stop: range.until,
          synced_at: new Date().toISOString(),
        });
      }
      if (adRows.length) {
        await supabase
          .from("crm_meta_ads_ads")
          .upsert(adRows, { onConflict: "account_id,ad_id,date_start,date_stop" });
      }

      await supabase
        .from("crm_meta_ads_accounts")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", acc.id);

      return new Response(
        JSON.stringify({
          success: true,
          campaigns: campaignsRows.length,
          adsets: adsetRows.length,
          ads: adRows.length,
          range,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[crm-meta-ads-sync] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
