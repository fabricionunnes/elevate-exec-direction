// client-traffic-leads-sync: puxa os leads dos FORMULÁRIOS NATIVOS do Meta
// (Lead Ads) pra aba Leads do Tráfego Pago do portal do cliente.
// Percorre as contas de meta_ads_accounts (módulo Meta Ads do PORTAL, por
// projeto — é a conta que o botão Conectar/Desconectar do módulo gerencia),
// lista os anúncios e lê /{ad_id}/leads (exige leads_retrieval no token —
// reconectar a conta no módulo Meta Ads se der erro de permissão).
// Dedup por meta_lead_id. Cron a cada 30 min.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.facebook.com/v21.0";

interface FieldData {
  name: string;
  values: string[];
}

function pickField(fields: FieldData[], ...names: string[]): string | null {
  for (const n of names) {
    const f = fields.find((x) => (x.name || "").toLowerCase().includes(n));
    const v = f?.values?.[0]?.trim();
    if (v) return v;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: accounts } = await supabase
      .from("meta_ads_accounts")
      .select("ad_account_id, ad_account_name, access_token, project_id")
      .not("project_id", "is", null)
      .eq("is_connected", true);

    const results: Record<string, unknown>[] = [];

    for (const acc of accounts || []) {
      let inserted = 0;
      let permissionError = false;
      try {
        // A Meta só entrega leads de Lead Ads com token de PÁGINA (user token
        // dá erro #100 mesmo com leads_retrieval). Busca as páginas do usuário
        // e o token de cada uma.
        const pageTokens = new Map<string, string>();
        const pagesRes = await fetch(
          `${GRAPH}/me/accounts?fields=id,access_token&limit=100&access_token=${acc.access_token}`,
        );
        const pagesData = await pagesRes.json();
        for (const p of pagesData.data || []) {
          if (p.id && p.access_token) pageTokens.set(String(p.id), p.access_token);
        }

        // Anúncios da conta (ativos primeiro; inclui pausados recentes pra não
        // perder lead). meta_ads_accounts guarda o id já com prefixo "act_".
        const actId = String(acc.ad_account_id).startsWith("act_")
          ? acc.ad_account_id
          : `act_${acc.ad_account_id}`;
        const adsRes = await fetch(
          `${GRAPH}/${actId}/ads?fields=id,name,effective_status,creative{effective_object_story_id}&limit=100&access_token=${acc.access_token}`,
        );
        const adsData = await adsRes.json();
        if (adsData.error) {
          results.push({ account: acc.ad_account_name, error: adsData.error.message?.slice(0, 150) });
          continue;
        }
        const ads = (adsData.data || []).filter((a: { effective_status: string }) =>
          ["ACTIVE", "PAUSED", "ADSET_PAUSED", "CAMPAIGN_PAUSED"].includes(a.effective_status),
        );

        // Leads dos últimos 90 dias por anúncio
        const since = Math.floor(Date.now() / 1000) - 90 * 86400;
        for (const ad of ads) {
          // página do anúncio (story id = "pageid_postid") → token da página
          const storyId = String(ad.creative?.effective_object_story_id || "");
          const pageId = storyId.split("_")[0];
          const leadToken = pageTokens.get(pageId) || acc.access_token;
          const leadsRes = await fetch(
            `${GRAPH}/${ad.id}/leads?fields=id,created_time,field_data&limit=100&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${since}}]&access_token=${leadToken}`,
          );
          const leadsData = await leadsRes.json();
          if (leadsData.error) {
            const msg = String(leadsData.error.message || "");
            if (msg.includes("leads_retrieval") || msg.includes("pages_manage_ads")) {
              permissionError = true;
              break; // token sem permissão: não adianta tentar os outros ads
            }
            continue;
          }

          for (const l of leadsData.data || []) {
            const fields: FieldData[] = l.field_data || [];
            const name =
              pickField(fields, "full_name", "nome", "name") || "Lead sem nome";
            const phone = pickField(fields, "phone", "telefone", "whatsapp", "celular");
            const email = pickField(fields, "email", "e-mail");

            const { error: insErr } = await supabase
              .from("client_traffic_leads")
              .insert({
                project_id: acc.project_id,
                name,
                phone,
                arrived_at: (l.created_time || new Date().toISOString()).slice(0, 10),
                source: "lead_ads",
                status: "novo",
                meta_lead_id: l.id,
                notes: email ? `Email: ${email} · Anúncio: ${ad.name}` : `Anúncio: ${ad.name}`,
              });
            // conflito no índice único de meta_lead_id = lead já importado
            if (!insErr) inserted++;
          }
        }
      } catch (e) {
        results.push({ account: acc.ad_account_name, error: String(e).slice(0, 150) });
        continue;
      }
      results.push({
        account: acc.ad_account_name,
        inserted,
        ...(permissionError
          ? { needs_reconnect: true, hint: "Token sem leads_retrieval — reconectar a conta no módulo Meta Ads" }
          : {}),
      });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
