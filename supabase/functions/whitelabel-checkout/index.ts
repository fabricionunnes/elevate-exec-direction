// Edge Function: whitelabel-checkout
// Cria customer + assinatura no Asaas para a landing self-service /assine
// e devolve o link de pagamento (boleto+pix). Salva o lead em whitelabel_signups.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

interface CheckoutPayload {
  company_name: string;
  slug: string;
  admin_name: string;
  admin_email: string;
  admin_phone: string;
  cpf_cnpj: string;
  plan_slug: "starter" | "pro" | "enterprise";
  billing_cycle?: "monthly" | "yearly";
}

function sanitizeDoc(s: string) {
  return (s || "").replace(/\D/g, "");
}
function sanitizeSlug(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const asaasKey = Deno.env.get("ASAAS_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body: CheckoutPayload = await req.json();

    // Validações
    const errors: string[] = [];
    if (!body.company_name?.trim()) errors.push("company_name");
    if (!body.admin_name?.trim()) errors.push("admin_name");
    if (!body.admin_email?.trim()) errors.push("admin_email");
    if (!body.admin_phone?.trim()) errors.push("admin_phone");
    if (!body.cpf_cnpj?.trim()) errors.push("cpf_cnpj");
    if (!body.plan_slug) errors.push("plan_slug");
    if (errors.length) {
      return new Response(JSON.stringify({ error: `Campos obrigatórios: ${errors.join(", ")}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slug = sanitizeSlug(body.slug || body.company_name);
    if (!slug) {
      return new Response(JSON.stringify({ error: "slug inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Slug já existe?
    const { data: existing } = await supabase
      .from("whitelabel_tenants").select("id").eq("slug", slug).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ error: `O endereço '${slug}' já está em uso. Escolha outro.` }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar plano
    const { data: plan, error: planErr } = await supabase
      .from("whitelabel_plans").select("*").eq("slug", body.plan_slug).eq("is_active", true).maybeSingle();
    if (planErr) throw planErr;
    if (!plan) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cycle = body.billing_cycle === "yearly" ? "yearly" : "monthly";
    const value = cycle === "yearly" && plan.price_yearly
      ? Number(plan.price_yearly)
      : Number(plan.price_monthly);
    const asaasCycle = cycle === "yearly" ? "YEARLY" : "MONTHLY";

    // 1) Criar/buscar customer no Asaas
    const cpfCnpj = sanitizeDoc(body.cpf_cnpj);
    const phone = sanitizeDoc(body.admin_phone);

    const customerSearch = await fetch(`${ASAAS_BASE}/customers?cpfCnpj=${cpfCnpj}`, {
      headers: { access_token: asaasKey, "Content-Type": "application/json" },
    });
    const customerSearchJson = await customerSearch.json();
    let customerId: string | null = customerSearchJson?.data?.[0]?.id || null;

    if (!customerId) {
      const createCustomer = await fetch(`${ASAAS_BASE}/customers`, {
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
      const cj = await createCustomer.json();
      if (!createCustomer.ok || !cj?.id) {
        console.error("[checkout] erro ao criar customer:", cj);
        return new Response(JSON.stringify({ error: cj?.errors?.[0]?.description || "Erro ao criar cliente no Asaas" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      customerId = cj.id;
    }

    // 2) Criar assinatura recorrente
    const today = new Date();
    const nextDue = new Date(today.getTime() + 24 * 60 * 60 * 1000); // 1 dia
    const dueDateStr = nextDue.toISOString().slice(0, 10);

    const subRes = await fetch(`${ASAAS_BASE}/subscriptions`, {
      method: "POST",
      headers: { access_token: asaasKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED", // cliente escolhe (boleto/pix/cartão)
        value,
        nextDueDate: dueDateStr,
        cycle: asaasCycle,
        description: `${plan.name} — ${body.company_name} (${cycle === "yearly" ? "anual" : "mensal"})`,
        externalReference: slug,
      }),
    });
    const subJson = await subRes.json();
    if (!subRes.ok || !subJson?.id) {
      console.error("[checkout] erro ao criar assinatura:", subJson);
      return new Response(JSON.stringify({ error: subJson?.errors?.[0]?.description || "Erro ao criar assinatura" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Buscar primeiro pagamento gerado pela assinatura
    const paymentsRes = await fetch(`${ASAAS_BASE}/subscriptions/${subJson.id}/payments`, {
      headers: { access_token: asaasKey, "Content-Type": "application/json" },
    });
    const paymentsJson = await paymentsRes.json();
    const firstPayment = paymentsJson?.data?.[0];
    const paymentId: string | null = firstPayment?.id || null;
    const invoiceUrl: string | null = firstPayment?.invoiceUrl || null;

    // 4) Salvar signup
    const { data: signup, error: signupErr } = await supabase
      .from("whitelabel_signups")
      .insert({
        company_name: body.company_name.trim(),
        slug,
        admin_name: body.admin_name.trim(),
        admin_email: body.admin_email.toLowerCase().trim(),
        admin_phone: phone,
        cpf_cnpj: cpfCnpj,
        plan_slug: body.plan_slug,
        billing_cycle: cycle,
        asaas_customer_id: customerId,
        asaas_subscription_id: subJson.id,
        asaas_payment_id: paymentId,
        payment_link: invoiceUrl,
        status: "pending",
      })
      .select("id").single();
    if (signupErr) {
      console.error("[checkout] erro ao salvar signup:", signupErr);
      throw signupErr;
    }

    return new Response(JSON.stringify({
      success: true,
      signup_id: signup.id,
      payment_link: invoiceUrl,
      payment_id: paymentId,
      subscription_id: subJson.id,
      slug,
      value,
      cycle,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[whitelabel-checkout] error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
