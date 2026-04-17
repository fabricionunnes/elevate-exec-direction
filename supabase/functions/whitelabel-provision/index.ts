// Edge Function: whitelabel-provision
// Cria um novo tenant white-label com admin, plano, módulos e estrutura padrão zerada.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ProvisionPayload {
  // Tenant
  name: string;
  slug: string;
  platform_name?: string;
  custom_domain?: string | null;
  logo_url?: string | null;
  // Plano
  plan_slug: "starter" | "pro" | "enterprise";
  // Trial opcional
  enable_trial?: boolean;
  trial_days?: number;
  // Admin do tenant
  admin_email: string;
  admin_name: string;
  admin_password?: string; // se omitido, geramos uma senha temporária
  // Módulos extra (override opcional ao plano)
  enabled_modules_override?: Record<string, boolean> | null;
}

function generatePassword(len = 14): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validar usuário chamador (precisa ser master)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const callerUserId = claimsData.claims.sub as string | undefined;
    const callerEmail = (claimsData.claims.email as string | undefined)?.toLowerCase();

    // Autorizado: CEO (email fixo) OU master da plataforma (staff role=master sem tenant_id)
    let authorized = callerEmail === "fabricio@universidadevendas.com.br";
    if (!authorized && callerUserId) {
      const adminClient = createClient(supabaseUrl, serviceKey);
      const { data: staffRow } = await adminClient
        .from("onboarding_staff")
        .select("role, is_active, tenant_id")
        .eq("user_id", callerUserId)
        .maybeSingle();
      if (staffRow?.is_active && staffRow.role === "master" && !staffRow.tenant_id) {
        authorized = true;
      }
    }
    if (!authorized) {
      return new Response(
        JSON.stringify({ error: "Forbidden — apenas masters da plataforma podem provisionar tenants" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body: ProvisionPayload = await req.json();

    // Validações básicas
    if (!body.name?.trim() || !body.slug?.trim() || !body.admin_email?.trim() || !body.admin_name?.trim() || !body.plan_slug) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: name, slug, plan_slug, admin_email, admin_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const slug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!slug) {
      return new Response(
        JSON.stringify({ error: "slug inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1) Buscar plano
    const { data: plan, error: planErr } = await supabase
      .from("whitelabel_plans")
      .select("*")
      .eq("slug", body.plan_slug)
      .eq("is_active", true)
      .maybeSingle();
    if (planErr) throw planErr;
    if (!plan) {
      return new Response(
        JSON.stringify({ error: `Plano '${body.plan_slug}' não encontrado` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Verificar slug/domínio únicos
    const { data: existingSlug } = await supabase
      .from("whitelabel_tenants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existingSlug) {
      return new Response(
        JSON.stringify({ error: `Slug '${slug}' já está em uso` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (body.custom_domain) {
      const { data: existingDomain } = await supabase
        .from("whitelabel_tenants")
        .select("id")
        .eq("custom_domain", body.custom_domain)
        .maybeSingle();
      if (existingDomain) {
        return new Response(
          JSON.stringify({ error: `Domínio '${body.custom_domain}' já está em uso` }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // 3) Criar usuário admin no auth (ou reaproveitar existente)
    const tempPassword = body.admin_password?.trim() || generatePassword();
    let adminUserId: string | null = null;
    let passwordReturned: string | null = tempPassword;

    const { data: createdUser, error: createUserErr } = await supabase.auth.admin.createUser({
      email: body.admin_email.toLowerCase().trim(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: body.admin_name.trim() },
    });

    if (createUserErr) {
      // Se já existe, busca o ID
      if (`${createUserErr.message}`.toLowerCase().includes("already") || createUserErr.status === 422) {
        const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
        const found = list?.users?.find(
          (u) => u.email?.toLowerCase() === body.admin_email.toLowerCase().trim(),
        );
        if (!found) throw createUserErr;
        adminUserId = found.id;
        passwordReturned = null; // não foi alterada
      } else {
        throw createUserErr;
      }
    } else {
      adminUserId = createdUser.user!.id;
    }

    // 4) Trial opcional
    let trial_ends_at: string | null = null;
    let initialStatus = "active";
    if (body.enable_trial) {
      const days = body.trial_days ?? 7;
      trial_ends_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      initialStatus = "trial";
    }

    // 5) Criar tenant
    const enabledModules =
      body.enabled_modules_override ?? (plan.enabled_modules as Record<string, boolean>) ?? {};

    const { data: tenant, error: tenantErr } = await supabase
      .from("whitelabel_tenants")
      .insert({
        name: body.name.trim(),
        slug,
        platform_name: body.platform_name?.trim() || body.name.trim(),
        custom_domain: body.custom_domain?.trim() || null,
        logo_url: body.logo_url?.trim() || null,
        status: initialStatus,
        max_active_projects: plan.max_projects ?? 5,
        plan_slug: body.plan_slug,
        enabled_modules: enabledModules,
        trial_ends_at,
        owner_user_id: adminUserId,
      })
      .select("*")
      .single();
    if (tenantErr) throw tenantErr;

    // 5.1) Criar registro de Staff Master vinculado ao tenant (acesso completo, isolado por tenant_id)
    try {
      const { error: staffErr } = await supabase.from("onboarding_staff").upsert(
        {
          user_id: adminUserId,
          name: body.admin_name.trim(),
          email: body.admin_email.toLowerCase().trim(),
          role: "master",
          tenant_id: tenant.id,
          is_active: true,
        },
        { onConflict: "email" },
      );
      if (staffErr) console.warn("[whitelabel-provision] staff upsert warning:", staffErr.message);
    } catch (e) {
      console.warn("[whitelabel-provision] staff seed skipped:", (e as Error).message);
    }

    // 6) Criar registro de assinatura interna (uso/billing)
    await supabase.from("whitelabel_subscriptions").upsert(
      {
        tenant_id: tenant.id,
        active_projects_count: 0,
        price_per_project: 0,
      },
      { onConflict: "tenant_id" },
    );

    // 7) Estrutura padrão zerada — somente CRM (1 pipeline com 6 etapas) para já funcionar
    // Apenas cria pipeline se a tabela existir e o módulo estiver ativo
    if (enabledModules?.crm !== false) {
      try {
        const { data: pipeline } = await supabase
          .from("crm_pipelines")
          .insert({
            name: "Comercial",
            description: "Pipeline padrão criado automaticamente",
            tenant_id: tenant.id,
            is_default: true,
          })
          .select("id")
          .maybeSingle();

        if (pipeline?.id) {
          const stages = [
            { name: "Novo Lead", color: "#3b82f6", sort_order: 1 },
            { name: "Qualificação", color: "#f59e0b", sort_order: 2 },
            { name: "Reunião Agendada", color: "#a855f7", sort_order: 3 },
            { name: "Proposta", color: "#0ea5e9", sort_order: 4 },
            { name: "Ganho", color: "#22c55e", sort_order: 5, is_won: true },
            { name: "Perdido", color: "#ef4444", sort_order: 6, is_lost: true },
          ];
          await supabase.from("crm_pipeline_stages").insert(
            stages.map((s) => ({ ...s, pipeline_id: pipeline.id, tenant_id: tenant.id })),
          );
        }
      } catch (e) {
        console.warn("CRM seed skipped:", (e as Error).message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenant,
        admin: {
          user_id: adminUserId,
          email: body.admin_email.toLowerCase().trim(),
          temp_password: passwordReturned, // null se usuário já existia
        },
        access_url: tenant.custom_domain
          ? `https://${tenant.custom_domain}`
          : `https://${slug}.nexus.com.br`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[whitelabel-provision] error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
