// Edge Function: whitelabel-asaas-webhook
// Recebe eventos do Asaas para assinaturas de white-label.
// Quando um pagamento é confirmado/recebido, provisiona o tenant automaticamente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generatePassword(len = 14): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const event = await req.json();
    const eventType: string = event?.event || "";
    const payment = event?.payment || {};
    const subscriptionId: string | undefined = payment?.subscription;
    const paymentId: string | undefined = payment?.id;

    console.log("[wl-webhook] event:", eventType, "sub:", subscriptionId, "pay:", paymentId);

    // Só nos interessam eventos de pagamento confirmado/recebido
    const PAID_EVENTS = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_RECEIVED_IN_CASH"];
    if (!PAID_EVENTS.includes(eventType)) {
      return new Response(JSON.stringify({ ok: true, ignored: eventType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!subscriptionId) {
      return new Response(JSON.stringify({ ok: true, reason: "no subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Caminho A: tenant criado manualmente pelo Master (pending_payment) =====
    // Procura por subscription_id OU por payment_id no whitelabel_tenants
    const { data: pendingTenant } = await supabase
      .from("whitelabel_tenants")
      .select("*")
      .or(`asaas_subscription_id.eq.${subscriptionId},asaas_first_payment_id.eq.${paymentId || "__none__"}`)
      .eq("payment_status", "pending")
      .maybeSingle();

    if (pendingTenant) {
      console.log("[wl-webhook] ativando tenant manual:", pendingTenant.slug);
      const { error: actErr } = await supabase
        .from("whitelabel_tenants")
        .update({
          status: "active",
          payment_status: "active",
          first_paid_at: new Date().toISOString(),
          asaas_first_payment_id: paymentId || pendingTenant.asaas_first_payment_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pendingTenant.id);
      if (actErr) console.error("[wl-webhook] erro ao ativar tenant:", actErr);

      // Notifica admin (best-effort)
      try {
        const { data: ownerStaff } = await supabase
          .from("onboarding_staff")
          .select("name, email, phone")
          .eq("user_id", pendingTenant.owner_user_id)
          .maybeSingle();

        if (ownerStaff?.phone) {
          await supabase.functions.invoke("evolution-api", {
            body: {
              action: "send-text",
              instanceName: "Fabricio Nunnes",
              number: ownerStaff.phone.replace(/\D/g, ""),
              text: `✅ Pagamento confirmado!\n\nO acesso à *${pendingTenant.name}* foi liberado. Faça login normalmente em: ${pendingTenant.custom_domain ? `https://${pendingTenant.custom_domain}` : `https://${pendingTenant.slug}.nexus.com.br`}`,
            },
          });
        }
      } catch (e) {
        console.warn("[wl-webhook] notify activation failed:", (e as Error).message);
      }

      return new Response(JSON.stringify({ ok: true, activated_tenant: pendingTenant.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Caminho B: signup público via /assine (whitelabel-checkout) =====
    const { data: signup, error: sErr } = await supabase
      .from("whitelabel_signups")
      .select("*")
      .eq("asaas_subscription_id", subscriptionId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!signup) {
      console.warn("[wl-webhook] signup/tenant não encontrado para assinatura", subscriptionId);
      return new Response(JSON.stringify({ ok: true, reason: "not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Já provisionado? Apenas marca como pago
    if (signup.status === "provisioned") {
      return new Response(JSON.stringify({ ok: true, already: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Marca como pago
    await supabase.from("whitelabel_signups").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      asaas_payment_id: paymentId || signup.asaas_payment_id,
    }).eq("id", signup.id);

    // ===== Provisionar tenant =====
    try {
      // Buscar plano
      const { data: plan } = await supabase
        .from("whitelabel_plans").select("*").eq("slug", signup.plan_slug).maybeSingle();

      // Criar usuário admin
      const tempPassword = generatePassword();
      let adminUserId: string | null = null;
      let passwordReturned: string | null = tempPassword;

      const { data: createdUser, error: createUserErr } = await supabase.auth.admin.createUser({
        email: signup.admin_email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: signup.admin_name },
      });
      if (createUserErr) {
        if (`${createUserErr.message}`.toLowerCase().includes("already") || createUserErr.status === 422) {
          const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
          const found = list?.users?.find((u) => u.email?.toLowerCase() === signup.admin_email);
          if (!found) throw createUserErr;
          adminUserId = found.id;
          passwordReturned = null;
        } else throw createUserErr;
      } else {
        adminUserId = createdUser.user!.id;
      }

      const enabledModules = (plan?.enabled_modules as Record<string, boolean>) ?? {};

      const { data: tenant, error: tErr } = await supabase
        .from("whitelabel_tenants")
        .insert({
          name: signup.company_name,
          slug: signup.slug,
          platform_name: signup.company_name,
          status: "active",
          max_active_projects: plan?.max_projects ?? 5,
          plan_slug: signup.plan_slug,
          enabled_modules: enabledModules,
          owner_user_id: adminUserId,
          asaas_customer_id: signup.asaas_customer_id,
          asaas_subscription_id: signup.asaas_subscription_id,
        })
        .select("*").single();
      if (tErr) throw tErr;

      await supabase.from("whitelabel_subscriptions").upsert(
        { tenant_id: tenant.id, active_projects_count: 0, price_per_project: 0 },
        { onConflict: "tenant_id" },
      );

      // Pipeline padrão
      if (enabledModules?.crm !== false) {
        try {
          const { data: pipeline } = await supabase
            .from("crm_pipelines")
            .insert({
              name: "Comercial",
              description: "Pipeline padrão",
              tenant_id: tenant.id,
              is_default: true,
            }).select("id").maybeSingle();
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
          console.warn("[wl-webhook] CRM seed skipped:", (e as Error).message);
        }
      }

      await supabase.from("whitelabel_signups").update({
        status: "provisioned",
        provisioned_at: new Date().toISOString(),
        provisioned_tenant_id: tenant.id,
      }).eq("id", signup.id);

      // TODO: enviar email/whatsapp com credenciais (passwordReturned)
      console.log("[wl-webhook] tenant provisionado:", tenant.slug, "admin:", signup.admin_email, "senha:", passwordReturned);

      return new Response(JSON.stringify({ ok: true, provisioned: true, tenant_id: tenant.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (provErr) {
      console.error("[wl-webhook] erro ao provisionar:", provErr);
      await supabase.from("whitelabel_signups").update({
        status: "failed",
        provisioning_error: (provErr as Error).message,
      }).eq("id", signup.id);
      // Devolve 200 para o Asaas não reenviar — o erro fica registrado para o master tratar
      return new Response(JSON.stringify({ ok: true, error: (provErr as Error).message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("[whitelabel-asaas-webhook] error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
