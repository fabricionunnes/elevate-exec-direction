// Edge Function: whitelabel-provision
// Cria um novo tenant white-label com admin, plano, módulos e estrutura padrão zerada.
// Quando require_payment=true: cria cobrança no Asaas, marca tenant como pending_payment,
// envia link de pagamento via WhatsApp + Email para o admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

interface ProvisionPayload {
  // Tenant
  name: string;
  slug: string;
  platform_name?: string;
  custom_domain?: string | null;
  logo_url?: string | null;
  // Plano
  plan_slug: "starter" | "pro" | "enterprise" | string;
  // Trial opcional
  enable_trial?: boolean;
  trial_days?: number;
  // Admin do tenant
  admin_email: string;
  admin_name: string;
  admin_phone?: string;
  admin_cpf_cnpj?: string;
  admin_password?: string;
  // Módulos extra (override opcional ao plano)
  enabled_modules_override?: Record<string, boolean> | null;
  // Cobrança
  require_payment?: boolean;          // se true, cria cobrança Asaas e bloqueia até pagar
  billing_cycle?: "monthly" | "yearly";
  notify_admin?: boolean;             // dispara WhatsApp + Email com o link
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

function sanitizeDoc(s: string) {
  return (s || "").replace(/\D/g, "");
}

async function notifyAdmin(opts: {
  supabase: any;
  email: string;
  name: string;
  phone?: string;
  paymentLink: string;
  planName: string;
  value: number;
  tenantName: string;
}) {
  const { email, name, phone, paymentLink, planName, value, tenantName } = opts;
  const valueFmt = value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  // 1) WhatsApp via instância "Fabricio Nunnes" (notificações internas)
  if (phone) {
    try {
      const message =
        `Olá ${name}! 👋\n\n` +
        `Sua conta *${tenantName}* foi criada na plataforma.\n\n` +
        `📋 Plano: *${planName}*\n` +
        `💰 Valor: *${valueFmt}/mês*\n\n` +
        `Para liberar o acesso, conclua o pagamento da primeira mensalidade pelo link abaixo (boleto/PIX/cartão):\n\n` +
        `🔗 ${paymentLink}\n\n` +
        `Assim que confirmarmos o pagamento, seu acesso será liberado automaticamente. ✅`;

      await opts.supabase.functions.invoke("evolution-api", {
        body: {
          action: "send-text",
          instanceName: "Fabricio Nunnes",
          number: sanitizeDoc(phone),
          text: message,
        },
      });
    } catch (e) {
      console.warn("[provision] whatsapp notify failed:", (e as Error).message);
    }
  }

  // 2) Email transacional (best-effort — não bloqueia)
  try {
    await opts.supabase.functions.invoke("send-transactional-email", {
      body: {
        to: email,
        subject: `Acesso ${tenantName} — Conclua o pagamento para ativar`,
        purpose: "transactional",
        idempotency_key: `wl-provision-${tenantName}-${Date.now()}`,
        html: `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
            <h2 style="margin:0 0 12px">Olá, ${name}!</h2>
            <p>Sua conta <strong>${tenantName}</strong> foi criada com sucesso na plataforma.</p>
            <p style="background:#f1f5f9;padding:12px;border-radius:8px;margin:16px 0">
              <strong>Plano:</strong> ${planName}<br/>
              <strong>Valor:</strong> ${valueFmt}/mês
            </p>
            <p>Para liberar o acesso, conclua o pagamento da primeira mensalidade:</p>
            <p style="text-align:center;margin:24px 0">
              <a href="${paymentLink}" style="background:#0ea5e9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">
                Pagar agora
              </a>
            </p>
            <p style="font-size:13px;color:#64748b">Assim que o pagamento for confirmado, seu acesso será liberado automaticamente.</p>
          </div>
        `,
      },
    });
  } catch (e) {
    console.warn("[provision] email notify failed:", (e as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const asaasKey = Deno.env.get("ASAAS_API_KEY")!;

    // Validar usuário chamador (precisa ser master)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerUserId = claimsData.claims.sub as string | undefined;
    const callerEmail = (claimsData.claims.email as string | undefined)?.toLowerCase();

    const supabase = createClient(supabaseUrl, serviceKey);

    let authorized = callerEmail === "fabricio@universidadevendas.com.br";
    if (!authorized && callerUserId) {
      const { data: staffRow } = await supabase
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

    if (!body.name?.trim() || !body.slug?.trim() || !body.admin_email?.trim() || !body.admin_name?.trim() || !body.plan_slug) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: name, slug, plan_slug, admin_email, admin_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const slug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!slug) {
      return new Response(JSON.stringify({ error: "slug inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cobrança exige telefone e CPF/CNPJ
    const requirePayment = !!body.require_payment;
    if (requirePayment) {
      if (!body.admin_phone?.trim() || !body.admin_cpf_cnpj?.trim()) {
        return new Response(
          JSON.stringify({ error: "Para gerar cobrança são obrigatórios telefone e CPF/CNPJ do admin" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // 1) Buscar plano
    const { data: plan, error: planErr } = await supabase
      .from("whitelabel_plans")
      .select("*")
      .eq("slug", body.plan_slug)
      .eq("is_active", true)
      .maybeSingle();
    if (planErr) throw planErr;
    if (!plan) {
      return new Response(JSON.stringify({ error: `Plano '${body.plan_slug}' não encontrado` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Verificar slug/domínio únicos
    const { data: existingSlug } = await supabase
      .from("whitelabel_tenants").select("id").eq("slug", slug).maybeSingle();
    if (existingSlug) {
      return new Response(JSON.stringify({ error: `Slug '${slug}' já está em uso` }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.custom_domain) {
      const { data: existingDomain } = await supabase
        .from("whitelabel_tenants").select("id").eq("custom_domain", body.custom_domain).maybeSingle();
      if (existingDomain) {
        return new Response(JSON.stringify({ error: `Domínio '${body.custom_domain}' já está em uso` }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3) Criar usuário admin
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
      if (`${createUserErr.message}`.toLowerCase().includes("already") || createUserErr.status === 422) {
        const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
        const found = list?.users?.find(
          (u) => u.email?.toLowerCase() === body.admin_email.toLowerCase().trim(),
        );
        if (!found) throw createUserErr;
        adminUserId = found.id;
        passwordReturned = null;
      } else {
        throw createUserErr;
      }
    } else {
      adminUserId = createdUser.user!.id;
    }

    // 4) Trial / status inicial
    let trial_ends_at: string | null = null;
    let initialStatus = "active";
    let paymentStatus = "not_required";

    if (body.enable_trial) {
      const days = body.trial_days ?? 7;
      trial_ends_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      initialStatus = "trial";
    }
    if (requirePayment) {
      initialStatus = "pending_payment";
      paymentStatus = "pending";
    }

    // 5) ===== COBRANÇA ASAAS (se require_payment) =====
    let asaasCustomerId: string | null = null;
    let asaasSubscriptionId: string | null = null;
    let asaasFirstPaymentId: string | null = null;
    let firstPaymentLink: string | null = null;
    let firstPaymentDueAt: string | null = null;

    if (requirePayment) {
      const cpfCnpj = sanitizeDoc(body.admin_cpf_cnpj!);
      const phone = sanitizeDoc(body.admin_phone!);
      const cycle = body.billing_cycle === "yearly" ? "yearly" : "monthly";
      const value = cycle === "yearly" && plan.price_yearly
        ? Number(plan.price_yearly)
        : Number(plan.price_monthly);
      const asaasCycle = cycle === "yearly" ? "YEARLY" : "MONTHLY";

      // Customer
      const csearch = await fetch(`${ASAAS_BASE}/customers?cpfCnpj=${cpfCnpj}`, {
        headers: { access_token: asaasKey, "Content-Type": "application/json" },
      });
      const csearchJson = await csearch.json();
      asaasCustomerId = csearchJson?.data?.[0]?.id || null;

      if (!asaasCustomerId) {
        const cres = await fetch(`${ASAAS_BASE}/customers`, {
          method: "POST",
          headers: { access_token: asaasKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: body.admin_name.trim(),
            email: body.admin_email.toLowerCase().trim(),
            mobilePhone: phone,
            cpfCnpj,
            notificationDisabled: false,
          }),
        });
        const cj = await cres.json();
        if (!cres.ok || !cj?.id) {
          throw new Error(cj?.errors?.[0]?.description || "Erro ao criar cliente no Asaas");
        }
        asaasCustomerId = cj.id;
      }

      // Assinatura recorrente — primeira fatura vence em 1 dia
      const due = new Date(Date.now() + 24 * 60 * 60 * 1000);
      firstPaymentDueAt = due.toISOString().slice(0, 10);

      const sres = await fetch(`${ASAAS_BASE}/subscriptions`, {
        method: "POST",
        headers: { access_token: asaasKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType: "UNDEFINED",
          value,
          nextDueDate: firstPaymentDueAt,
          cycle: asaasCycle,
          description: `${plan.name} — ${body.name.trim()} (white-label ${cycle === "yearly" ? "anual" : "mensal"})`,
          externalReference: `wl_tenant:${slug}`,
        }),
      });
      const sj = await sres.json();
      if (!sres.ok || !sj?.id) {
        throw new Error(sj?.errors?.[0]?.description || "Erro ao criar assinatura no Asaas");
      }
      asaasSubscriptionId = sj.id;

      // Buscar primeiro pagamento gerado
      const pres = await fetch(`${ASAAS_BASE}/subscriptions/${sj.id}/payments`, {
        headers: { access_token: asaasKey, "Content-Type": "application/json" },
      });
      const pj = await pres.json();
      const firstPayment = pj?.data?.[0];
      asaasFirstPaymentId = firstPayment?.id || null;
      firstPaymentLink = firstPayment?.invoiceUrl || null;
    }

    // 6) Criar tenant
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
        // Cobrança
        payment_status: paymentStatus,
        asaas_customer_id: asaasCustomerId,
        asaas_subscription_id: asaasSubscriptionId,
        asaas_first_payment_id: asaasFirstPaymentId,
        first_payment_link: firstPaymentLink,
        first_payment_due_at: firstPaymentDueAt,
      })
      .select("*")
      .single();
    if (tenantErr) throw tenantErr;

    // Staff master vinculado ao tenant
    try {
      await supabase.from("onboarding_staff").upsert(
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
    } catch (e) {
      console.warn("[whitelabel-provision] staff seed:", (e as Error).message);
    }

    await supabase.from("whitelabel_subscriptions").upsert(
      { tenant_id: tenant.id, active_projects_count: 0, price_per_project: 0 },
      { onConflict: "tenant_id" },
    );

    // CRM seed
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

    // 7) Notificar admin (best-effort — não falha o provisionamento)
    if (requirePayment && firstPaymentLink && body.notify_admin !== false) {
      await notifyAdmin({
        supabase,
        email: body.admin_email.toLowerCase().trim(),
        name: body.admin_name.trim(),
        phone: body.admin_phone,
        paymentLink: firstPaymentLink,
        planName: plan.name,
        value: Number(plan.price_monthly),
        tenantName: body.name.trim(),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenant,
        admin: {
          user_id: adminUserId,
          email: body.admin_email.toLowerCase().trim(),
          temp_password: passwordReturned,
        },
        access_url: tenant.custom_domain
          ? `https://${tenant.custom_domain}`
          : `https://${slug}.nexus.com.br`,
        payment: requirePayment ? {
          status: paymentStatus,
          link: firstPaymentLink,
          due_date: firstPaymentDueAt,
          subscription_id: asaasSubscriptionId,
        } : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[whitelabel-provision] error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
