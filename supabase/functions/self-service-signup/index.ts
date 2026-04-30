// Self-service signup: cria auth user + empresa + projeto + onboarding_user + permissões KPIs
// Endpoint público (verify_jwt=false). Usa service role para bypassar RLS.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SignupBody {
  name: string;
  email: string;
  password: string;
  company_name?: string;
  phone?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SignupBody;

    const name = (body.name || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const companyName = (body.company_name || name || "Minha Empresa").trim();
    const phone = (body.phone || "").trim();

    if (!name || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Nome, email e senha são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha precisa ter pelo menos 6 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Email inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // 1. Cria usuário no auth (auto-confirmado)
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, source: "self_service" },
    });

    if (createErr || !created?.user) {
      const msg = createErr?.message || "Erro ao criar usuário.";
      const friendly = msg.includes("already registered") || msg.includes("already been registered")
        ? "Este email já está cadastrado. Faça login."
        : msg;
      return new Response(
        JSON.stringify({ error: friendly }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = created.user.id;

    // 2. Cria empresa (sem tenant_id = global UNV)
    const { data: company, error: companyErr } = await supabase
      .from("onboarding_companies")
      .insert({
        name: companyName,
        email,
        phone: phone || null,
        status: "active",
      })
      .select("id")
      .single();

    if (companyErr || !company) {
      // rollback do auth user
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Erro ao criar empresa: " + (companyErr?.message || "desconhecido") }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Cria projeto vinculado
    const { data: project, error: projectErr } = await supabase
      .from("onboarding_projects")
      .insert({
        product_id: "self_service",
        product_name: "Self-Service KPIs",
        onboarding_company_id: company.id,
        status: "active",
      })
      .select("id")
      .single();

    if (projectErr || !project) {
      await supabase.from("onboarding_companies").delete().eq("id", company.id);
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Erro ao criar projeto: " + (projectErr?.message || "desconhecido") }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Cria onboarding_user (gerente, para herdar sistema de permissões granulares)
    const { data: ou, error: ouErr } = await supabase
      .from("onboarding_users")
      .insert({
        project_id: project.id,
        user_id: userId,
        name,
        email,
        role: "gerente",
        password_changed: true,
      })
      .select("id")
      .single();

    if (ouErr || !ou) {
      await supabase.from("onboarding_projects").delete().eq("id", project.id);
      await supabase.from("onboarding_companies").delete().eq("id", company.id);
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Erro ao vincular usuário: " + (ouErr?.message || "desconhecido") }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Permissões: somente KPIs (e sub-permissões para acesso completo a esse módulo)
    const allowedMenus = [
      "kpis",
      "kpis_dashboard",
      "kpis_endomarketing",
      "kpis_sales_links",
      "kpis_config",
    ];
    const permsRows = allowedMenus.map((menu_key) => ({ user_id: ou.id, menu_key }));
    await supabase.from("client_user_permissions").insert(permsRows);

    // 6. project_menu_permissions: limitar projeto a apenas dashboard/KPIs.
    // Quando NÃO existe linha para um menu, useClientPermissions trata como "todos liberados",
    // então aqui inserimos APENAS as chaves liberadas como is_enabled=true.
    // Para bloquear o resto, registramos as chaves não-permitidas como is_enabled=false.
    const allClientMenus = [
      "kpis", "kpis_dashboard", "kpis_endomarketing", "kpis_sales_links", "kpis_config",
      "pontuacao", "jornada_trilha", "jornada_lista", "jornada_cronograma",
      "gestao_clientes", "gestao_vendas", "gestao_financeiro", "gestao_estoque",
      "chamados", "reunioes", "testes", "rh", "board", "indicar",
      "gestao_agendamentos", "minhas_faturas", "trafego_pago",
      "gestao_usuarios", "unv_circle", "unv_disparador", "crm_unv", "unv_academy",
      "funil_vendas", "instagram", "diretor_comercial_ia", "outros_servicos",
      "unv_social", "contrato_rotina", "acoes_comerciais", "meta_ads", "prospeccao_b2b",
      "crm_comercial", "crm_comercial_dashboard", "crm_comercial_negocios",
      "crm_comercial_contatos", "crm_comercial_atividades", "crm_comercial_atendimentos",
      "crm_comercial_transcricoes", "crm_comercial_contratos", "crm_comercial_reunioes",
      "diagnostico", "unv_office", "sf_comissoes",
    ];
    const projectPerms = allClientMenus.map((menu_key) => ({
      project_id: project.id,
      menu_key,
      is_enabled: allowedMenus.includes(menu_key),
    }));
    await supabase.from("project_menu_permissions").insert(projectPerms);

    return new Response(
      JSON.stringify({
        success: true,
        project_id: project.id,
        user_id: userId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message || "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
