// dialer-companies: lista empresas e seus usuários (pra liberar o discador a cliente existente). Só UNV.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await supabase.auth.getUser(jwt);
    const uid = u?.user?.id;
    const { data: me } = uid ? await supabase.from("onboarding_staff").select("role, tenant_id, is_active").eq("user_id", uid).maybeSingle() : { data: null };
    if (!me || !me.is_active || me.tenant_id || !["master", "admin", "head_comercial"].includes(me.role)) {
      return json({ error: "Acesso restrito à UNV" }, 403);
    }

    const body = await req.json().catch(() => ({}));

    if (body.action === "users") {
      const companyId: string = body.companyId;
      if (!companyId) throw new Error("companyId é obrigatório");
      // usuários da empresa via projetos
      const { data: projects } = await supabase.from("onboarding_projects").select("id").eq("company_id", companyId);
      const projIds = (projects || []).map((p: any) => p.id);
      let users: any[] = [];
      if (projIds.length) {
        const { data } = await supabase.from("onboarding_users").select("id, name, email, dialer_enabled").in("project_id", projIds);
        users = data || [];
      }
      // dedup por email
      const seen = new Set<string>();
      users = users.filter((x) => { const k = (x.email || x.id).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
      return json({ users });
    }

    // list (default): busca empresas por nome
    const search = (body.search || "").trim();
    let q = supabase.from("onboarding_companies").select("id, name, cnpj, tenant_id").order("name");
    if (search) q = q.ilike("name", `%${search}%`);
    const { data: companies } = await q.limit(40);
    return json({ companies: companies || [] });
  } catch (error: any) {
    return json({ error: error?.message || String(error) }, 500);
  }
  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
