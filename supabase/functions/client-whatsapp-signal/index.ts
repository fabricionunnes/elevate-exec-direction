// client-whatsapp-signal: sinal de saúde por cliente a partir da atividade nos grupos de WhatsApp
// (sistema do Marcelo, outra conta Supabase, via MARCELO_SUPABASE_URL/MARCELO_SERVICE_KEY).
// Cruza por company_id (mesmo id das duas pontas). Grava em client_whatsapp_signals. Cron diário.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const MARCELO_URL = Deno.env.get("MARCELO_SUPABASE_URL") || "";
    const MARCELO_KEY = Deno.env.get("MARCELO_SERVICE_KEY") || "";
    if (!MARCELO_URL || !MARCELO_KEY) {
      return json({ ok: false, reason: "marcelo_env_missing", updated: 0 });
    }

    // 1) clientes ativos do Nexus
    const { data: companies } = await supabase
      .from("onboarding_companies").select("id").eq("status", "active");
    const companyIds = (companies || []).map((c: any) => c.id);
    if (!companyIds.length) return json({ ok: true, updated: 0 });

    const mh = { apikey: MARCELO_KEY, Authorization: `Bearer ${MARCELO_KEY}` };

    // 2) grupos -> empresa (filtra pelos clientes ativos)
    const jidToCompany = new Map<string, string>();
    const companiesWithGroup = new Set<string>();
    const jids: string[] = [];
    for (let i = 0; i < companyIds.length; i += 100) {
      const chunk = companyIds.slice(i, i + 100);
      const r = await fetch(`${MARCELO_URL}/rest/v1/marcelo_groups?select=company_id,group_jid&company_id=in.(${chunk.join(",")})`, { headers: mh });
      const groups = r.ok ? await r.json() : [];
      for (const g of groups) {
        if (g.group_jid && g.company_id) { jidToCompany.set(g.group_jid, g.company_id); companiesWithGroup.add(g.company_id); jids.push(g.group_jid); }
      }
    }

    // 3) mensagens dos últimos 7 dias -> última atividade + contagem por empresa
    const nowMs = Date.now();
    const since = new Date(nowMs - 7 * 86400000).toISOString();
    const lastByCompany = new Map<string, number>();
    const countByCompany = new Map<string, number>();
    for (let i = 0; i < jids.length; i += 150) {
      const chunk = jids.slice(i, i + 150);
      const jidList = chunk.map((j) => `"${j}"`).join(",");
      const r = await fetch(`${MARCELO_URL}/rest/v1/marcelo_group_messages?select=group_jid,msg_timestamp&group_jid=in.(${jidList})&msg_timestamp=gte.${since}&order=msg_timestamp.desc&limit=5000`, { headers: mh });
      const msgs = r.ok ? await r.json() : [];
      for (const m of msgs) {
        const cid = jidToCompany.get(m.group_jid);
        if (!cid) continue;
        const t = new Date(m.msg_timestamp).getTime();
        if (!lastByCompany.has(cid) || t > (lastByCompany.get(cid) as number)) lastByCompany.set(cid, t);
        countByCompany.set(cid, (countByCompany.get(cid) || 0) + 1);
      }
    }

    // 4) calcula RAG e faz upsert
    const rows = companyIds.map((cid: string) => {
      const hasGroup = companiesWithGroup.has(cid);
      const last = lastByCompany.get(cid) || null;
      let rag: string | null = null;
      if (hasGroup) {
        if (last && nowMs - last <= 3 * 86400000) rag = "green";
        else if (last && nowMs - last <= 7 * 86400000) rag = "yellow";
        else rag = "red"; // tem grupo mas sem mensagem há 7+ dias
      }
      return {
        company_id: cid,
        msgs_7d: countByCompany.get(cid) || 0,
        last_message_at: last ? new Date(last).toISOString() : null,
        rag,
        updated_at: new Date(nowMs).toISOString(),
      };
    });
    let upsertError: string | null = null;
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from("client_whatsapp_signals").upsert(rows.slice(i, i + 200), { onConflict: "company_id" });
      if (error) { upsertError = error.message; break; }
    }

    return json({ ok: !upsertError, upsertError, updated: rows.length, withGroup: companiesWithGroup.size, active: lastByCompany.size });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || String(error) }, 500);
  }

  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
