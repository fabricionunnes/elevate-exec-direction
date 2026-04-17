// Edge Function: whitelabel-upgrade-checkout
// Gera uma cobrança avulsa no Asaas para upgrade de plano de um tenant existente.
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
  customer?: {
    name?: string;
    email?: string;
    cpf_cnpj?: string;
    phone?: string;
  };
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
      .select("id, name, slug, plan_slug, asaas_customer_id, max_active_projects, owner_user_id")
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

    // Coletar dados do owner — primeiro do payload, depois do auth.users
    let ownerName = body.customer?.name || tenant.name;
    let ownerEmail = body.customer?.email || "";
    let ownerPhone = (body.customer?.phone || "").replace(/\D/g, "");
    let ownerDoc = (body.customer?.cpf_cnpj || "").replace(/\D/g, "");

    if (tenant.owner_user_id && (!ownerEmail || !ownerDoc)) {
      const { data: u } = await supabase.auth.admin.getUserById(tenant.owner_user_id);
      const meta: any = u?.user?.user_metadata || {};
      if (!ownerEmail) ownerEmail = u?.user?.email || "";
      if (!ownerName || ownerName === tenant.name) ownerName = meta.name || meta.full_name || ownerName;
      if (!ownerPhone) ownerPhone = String(meta.phone || "").replace(/\D/g, "");
      if (!ownerDoc) ownerDoc = String(meta.cpf_cnpj || meta.cpf || meta.cnpj || "").replace(/\D/g, "");
    }

    let customerId = tenant.asaas_customer_id;

    // Garantir customer no Asaas — se já existe, segue. Se não, exige CPF/CNPJ.
    if (!customerId) {
      if (!ownerDoc) {
        return new Response(JSON.stringify({
          error: "missing_customer_data",
          message: "Para gerar a cobrança precisamos do CPF/CNPJ do responsável pelo tenant.",
          required_fields: ["cpf_cnpj", "name", "email", "phone"],
        }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const custBody: any = {
        name: ownerName,
        email: ownerEmail,
        mobilePhone: ownerPhone,
        cpfCnpj: ownerDoc,
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
    } else if (ownerDoc) {
      // Atualiza customer existente com doc/dados se fornecidos (idempotente)
      try {
        await fetch(`${ASAAS_BASE}/customers/${customerId}`, {
          method: "POST",
          headers: { "access_token": asaasKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: ownerName,
            email: ownerEmail || undefined,
            mobilePhone: ownerPhone || undefined,
            cpfCnpj: ownerDoc,
          }),
        });
      } catch (_e) { /* ignore */ }
    }

    // Cria cobrança da primeira mensalidade do novo plano
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const paymentBody = {
      customer: customerId,
      billingType: "UNDEFINED",
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
    if (!payRes.ok) {
      // Se o erro for de doc faltando no customer existente, sinaliza para coletar
      const desc = payData?.errors?.[0]?.description || "";
      if (/CPF|CNPJ/i.test(desc)) {
        return new Response(JSON.stringify({
          error: "missing_customer_data",
          message: "O cliente no Asaas precisa de CPF/CNPJ. Informe abaixo para continuar.",
          required_fields: ["cpf_cnpj", "name", "email", "phone"],
        }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("Erro Asaas cobrança: " + JSON.stringify(payData));
    }

    await supabase.from("whitelabel_tenant_plan_history").insert({
      tenant_id: tenant.id,
      previous_plan_slug: tenant.plan_slug,
      new_plan_slug: plan.slug,
      previous_max_projects: tenant.max_active_projects,
      new_max_projects: plan.max_projects,
      previous_max_users: null,
      new_max_users: plan.max_users,
      changed_by_name: ownerName || "Self-service WL",
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
