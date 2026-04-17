// Edge Function: whitelabel-upgrade-checkout
// Gera uma cobrança avulsa no Asaas para upgrade de plano de um tenant existente.
// Retorna o link de pagamento para o cliente WL pagar e ativar o novo plano.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

interface Payload {
  tenant_id: string;
  target_plan_slug: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const asaasKey = Deno.env.get("ASAAS_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body: Payload = await req.json();
    if (!body.tenant_id || !body.target_plan_slug) {
      return new Response(JSON.stringify({ error: "tenant_id e target_plan_slug obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar tenant
    const { data: tenant, error: tErr } = await supabase
      .from("whitelabel_tenants")
      .select("id, name, slug, plan_slug, asaas_customer_id, max_active_projects")
      .eq("id", body.tenant_id)
      .maybeSingle();
    if (tErr || !tenant) throw new Error("Tenant não encontrado");

    // Buscar plano alvo
    const { data: plan, error: pErr } = await supabase
      .from("whitelabel_plans")
      .select("slug, name, price_monthly, max_projects, max_users")
      .eq("slug", body.target_plan_slug)
      .eq("is_active", true)
      .maybeSingle();
    if (pErr || !plan) throw new Error("Plano de destino não encontrado");

    // Buscar dono para identificação no Asaas
    const { data: owner } = await supabase
      .from("whitelabel_tenant_users")
      .select("user_id, name, email, phone, cpf_cnpj")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let customerId = tenant.asaas_customer_id;

    // Garantir customer no Asaas
    if (!customerId) {
      const custBody: any = {
        name: owner?.name || tenant.name,
        email: owner?.email,
        mobilePhone: (owner?.phone || "").replace(/\D/g, ""),
        cpfCnpj: (owner?.cpf_cnpj || "").replace(/\D/g, ""),
        externalReference: `tenant:${tenant.id}`,
      };
      const custRes = await fetch(`${ASAAS_BASE}/customers`, {
        method: "POST",
        headers: { "access_token": asaasKey, "Content-Type": "application/json" },
        body: JSON.stringify(custBody),
      });
      const custData = await custRes.json();
      if (!custRes.ok) throw new Error("Erro Asaas customer: " + JSON.stringify(custData));
      customerId = custData.id;
      await supabase.from("whitelabel_tenants").update({ asaas_customer_id: customerId }).eq("id", tenant.id);
    }

    // Cria cobrança da primeira mensalidade do novo plano (PIX + Boleto)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const paymentBody = {
      customer: customerId,
      billingType: "UNDEFINED", // permite escolher pix/boleto/cartão
      value: Number(plan.price_monthly),
      dueDate: dueDate.toISOString().slice(0, 10),
      description: `Upgrade WL ${tenant.name} → Plano ${plan.name}`,
      externalReference: `wl-upgrade:${tenant.id}:${plan.slug}`,
    };
    const payRes = await fetch(`${ASAAS_BASE}/payments`, {
      method: "POST",
      headers: { "access_token": asaasKey, "Content-Type": "application/json" },
      body: JSON.stringify(paymentBody),
    });
    const payData = await payRes.json();
    if (!payRes.ok) throw new Error("Erro Asaas cobrança: " + JSON.stringify(payData));

    // Registra solicitação no histórico (status pending)
    await supabase.from("whitelabel_tenant_plan_history").insert({
      tenant_id: tenant.id,
      previous_plan_slug: tenant.plan_slug,
      new_plan_slug: plan.slug,
      previous_max_projects: tenant.max_active_projects,
      new_max_projects: plan.max_projects,
      previous_max_users: null,
      new_max_users: plan.max_users,
      changed_by_name: owner?.name || "Self-service WL",
      reason: `Upgrade self-service. Cobrança Asaas: ${payData.id}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        invoice_url: payData.invoiceUrl,
        bank_slip_url: payData.bankSlipUrl,
        payment_id: payData.id,
        value: Number(plan.price_monthly),
        plan_name: plan.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("whitelabel-upgrade-checkout error", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
