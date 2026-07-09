// dialer-lead-intake: recebe leads via API (header x-api-key do tenant) e joga no funil Discador.
// Permite o cliente conectar qualquer CRM/funil dele ao discador.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

function digits(s: string): string { return (s || "").replace(/[^\d+]/g, ""); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = req.headers.get("x-api-key") || "";
    if (!apiKey) return json({ error: "x-api-key obrigatório" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: keyRow } = await supabase
      .from("dialer_api_keys").select("id, tenant_id, is_active").eq("api_key", apiKey).maybeSingle();
    if (!keyRow || !keyRow.is_active) return json({ error: "API key inválida" }, 401);
    const tenantId: string | null = keyRow.tenant_id;

    const body = await req.json().catch(() => ({}));
    const incoming: any[] = Array.isArray(body) ? body : Array.isArray(body.leads) ? body.leads : [body];
    if (!incoming.length) return json({ error: "Envie 'leads' (array) ou um lead no corpo" }, 400);

    // funil Discador do tenant (service role -> filtra explicitamente)
    let pq = supabase.from("crm_pipelines").select("id").eq("name", "Discador").eq("is_active", true);
    pq = tenantId ? pq.eq("tenant_id", tenantId) : pq.is("tenant_id", null);
    const { data: pipeline } = await pq.maybeSingle();
    let stageId: string | null = null;
    if (pipeline?.id) {
      const { data: stage } = await supabase.from("crm_stages").select("id").eq("pipeline_id", pipeline.id).order("sort_order", { ascending: true }).limit(1).maybeSingle();
      stageId = stage?.id || null;
    }

    const leads = incoming.map((r) => {
      const phone = digits(r.phone || r.telefone || r.celular || r.whatsapp || "");
      return {
        name: (r.name || r.nome || r.contato || phone || "Lead").toString().slice(0, 200),
        phone: phone || null,
        email: r.email || null,
        company: r.company || r.empresa || null,
        city: r.city || r.cidade || null,
        state: r.state || r.estado || r.uf || null,
        tenant_id: tenantId,                 // explícito: o trigger respeita
        pipeline_id: pipeline?.id || null,
        stage_id: stageId,
      };
    }).filter((l) => l.phone);

    if (!leads.length) return json({ error: "Nenhum lead com telefone" }, 400);

    let inserted = 0;
    for (let i = 0; i < leads.length; i += 500) {
      const { error } = await supabase.from("crm_leads").insert(leads.slice(i, i + 500));
      if (error) throw error;
      inserted += Math.min(500, leads.length - i);
    }
    await supabase.from("dialer_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);

    return json({ ok: true, inserted });
  } catch (error: any) {
    return json({ error: error?.message || String(error) }, 500);
  }

  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
