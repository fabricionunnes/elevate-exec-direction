// UNV IA Academy — checkout, status e eventos do Asaas.
//
// Planos: anual R$ 2.497 (YEARLY) e mensal R$ 297 (MONTHLY), Pix ou cartão.
// A conta de acesso (auth) nasce no checkout com a senha escolhida pelo aluno;
// o acesso ao Academy (empresa + projeto + onboarding_user + academy_user_access)
// só é criado quando o pagamento confirma (webhook do Asaas ou polling).
//
// Endpoint público (verify_jwt=false). Usa service role.
//   POST { action: "create", name, email, whatsapp, cpf, password, plan, payment_method, fbclid, utm }
//   POST { action: "status", subscription_id }
//   POST { action: "asaas_event", event, payment }   ← encaminhado pela asaas-webhook
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_KEY = Deno.env.get("ASAAS_API_KEY") || "";
const ASAAS_BASE = "https://api.asaas.com/v3";
const SITE_URL = Deno.env.get("SITE_URL") || "https://unvholdings.com.br";

const PLANS = {
  annual: { amount_cents: 249700, cycle: "YEARLY", label: "UNV IA Academy — plano anual" },
  monthly: { amount_cents: 29700, cycle: "MONTHLY", label: "UNV IA Academy — plano mensal" },
} as const;
type PlanKey = keyof typeof PLANS;

const EXT_REF_PREFIX = "ia-academy:";

// Menus do portal do cliente liberados pro assinante (só Academy)
const ALLOWED_MENUS = ["unv_academy"];
const ALL_CLIENT_MENUS = [
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

async function asaas(path: string, method: string, body?: unknown) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", access_token: ASAAS_KEY },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* noop */ }
  if (!res.ok) throw new Error(data?.errors?.[0]?.description || `Asaas HTTP ${res.status}`);
  return data;
}

function cpfValido(raw: string): boolean {
  const c = (raw || "").replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(c.slice(0, 9), 10) === Number(c[9]) && calc(c.slice(0, 10), 11) === Number(c[10]);
}

function isPaidStatus(s: string) {
  return ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(s);
}

function todayBRT(): Date {
  return new Date(Date.now() - 3 * 3600000);
}

function addPeriod(plan: PlanKey, from: Date): string {
  const d = new Date(from);
  if (plan === "annual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------
// Ativação (idempotente): empresa + projeto + onboarding_user + acesso Academy
// ---------------------------------------------------------------------
async function activate(sb: SupabaseClient, sub: any, paymentId?: string | null) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: "active",
    paid_at: sub.paid_at || now,
    current_period_end: addPeriod(sub.plan as PlanKey, todayBRT()),
  };
  if (paymentId && !sub.asaas_payment_id) patch.asaas_payment_id = paymentId;

  let userId: string | null = sub.user_id || null;
  let companyId: string | null = sub.onboarding_company_id || null;
  let projectId: string | null = sub.onboarding_project_id || null;
  let onbUserId: string | null = sub.onboarding_user_id || null;
  let createdNow = false;

  // 1. usuário auth (normalmente já existe, criado no checkout)
  if (!userId) {
    const { data: found } = await sb.rpc("ia_academy_find_user_by_email", { p_email: sub.email });
    userId = (found as string) || null;
  }
  if (!userId) {
    const tempPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 10) + "Ia!";
    const { data: created, error } = await sb.auth.admin.createUser({
      email: sub.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: sub.name, source: "ia_academy" },
    });
    if (error || !created?.user) throw new Error("Não consegui criar o usuário: " + (error?.message || "?"));
    userId = created.user.id;
    createdNow = true;
    (patch as any)._temp_password = tempPassword; // só pra mensagem de boas-vindas
  }
  patch.user_id = userId;

  // 2. onboarding_user existente pro mesmo auth user? reaproveita (cliente DCT, por exemplo)
  if (!onbUserId) {
    const { data: existingOu } = await sb
      .from("onboarding_users")
      .select("id, project_id, onboarding_projects!inner(onboarding_company_id)")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (existingOu?.id) {
      onbUserId = existingOu.id;
      projectId = existingOu.project_id;
      companyId = (existingOu as any).onboarding_projects?.onboarding_company_id || null;
    }
  }

  // 3. empresa + projeto + onboarding_user novos
  if (!onbUserId) {
    if (!companyId) {
      const { data: company, error: cErr } = await sb
        .from("onboarding_companies")
        .insert({
          name: sub.company_name || sub.name,
          email: sub.email,
          phone: sub.whatsapp || null,
          status: "active",
        })
        .select("id")
        .single();
      if (cErr || !company) throw new Error("Erro ao criar empresa: " + (cErr?.message || "?"));
      companyId = company.id;
    }
    if (!projectId) {
      const { data: project, error: pErr } = await sb
        .from("onboarding_projects")
        .insert({
          product_id: "ia_academy",
          product_name: "UNV IA Academy",
          onboarding_company_id: companyId,
          status: "active",
          contract_start_date: todayBRT().toISOString().slice(0, 10),
          contract_value: sub.amount_cents / 100,
        })
        .select("id")
        .single();
      if (pErr || !project) throw new Error("Erro ao criar projeto: " + (pErr?.message || "?"));
      projectId = project.id;

      // portal do cliente só com o Academy
      await sb.from("project_menu_permissions").insert(
        ALL_CLIENT_MENUS.map((menu_key) => ({ project_id: projectId, menu_key, is_enabled: ALLOWED_MENUS.includes(menu_key) })),
      );
    }
    const { data: ou, error: ouErr } = await sb
      .from("onboarding_users")
      .insert({
        project_id: projectId,
        user_id: userId,
        name: sub.name,
        email: sub.email,
        role: "client",
        password_changed: true,
      })
      .select("id")
      .single();
    if (ouErr || !ou) throw new Error("Erro ao criar aluno: " + (ouErr?.message || "?"));
    onbUserId = ou.id;
  }

  // 4. acesso ao Academy (gate explícito, além do papel client)
  const { data: hasAccess } = await sb
    .from("academy_user_access")
    .select("id")
    .eq("onboarding_user_id", onbUserId)
    .is("track_id", null)
    .limit(1);
  if (!hasAccess || hasAccess.length === 0) {
    await sb.from("academy_user_access").insert({
      onboarding_user_id: onbUserId,
      company_id: companyId,
      project_id: projectId,
      access_level: "full",
      is_active: true,
    });
  } else {
    await sb.from("academy_user_access").update({ is_active: true }).eq("onboarding_user_id", onbUserId);
  }

  // 5. lead no CRM (best-effort)
  let crmLeadId: string | null = sub.crm_lead_id || null;
  if (!crmLeadId) {
    try {
      const { data: lead } = await sb
        .from("crm_leads")
        .insert({
          name: sub.name,
          email: sub.email,
          phone: sub.whatsapp || null,
          document: sub.cpf || null,
          company: sub.company_name || null,
          origin: "ia_academy",
          utm_source: (sub.utm as any)?.utm_source || null,
          notes: `Assinante UNV IA Academy — plano ${sub.plan === "annual" ? "anual" : "mensal"} (R$ ${(sub.amount_cents / 100).toLocaleString("pt-BR")})`,
        })
        .select("id")
        .single();
      crmLeadId = lead?.id || null;
    } catch (e) {
      console.error("[ia-academy] crm lead", e);
    }
  }

  const tempPassword = (patch as any)._temp_password as string | undefined;
  delete (patch as any)._temp_password;

  await sb
    .from("ia_academy_subscriptions")
    .update({
      ...patch,
      onboarding_company_id: companyId,
      onboarding_project_id: projectId,
      onboarding_user_id: onbUserId,
      crm_lead_id: crmLeadId,
    })
    .eq("id", sub.id);

  // 6. boas-vindas (best-effort): WhatsApp + e-mail, só na primeira ativação
  if (sub.status === "pending") {
    await sendWelcome(sb, { ...sub, user_id: userId }, createdNow ? tempPassword : undefined).catch((e) =>
      console.error("[ia-academy] welcome", e),
    );
  }
}

async function sendWelcome(sb: SupabaseClient, sub: any, tempPassword?: string) {
  const loginUrl = `${SITE_URL}/#/onboarding-tasks/login?redirect=${encodeURIComponent("/academy")}`;
  const firstName = String(sub.name || "").trim().split(" ")[0] || "tudo bem";
  const planLabel = sub.plan === "annual" ? "anual" : "mensal";

  // e-mail (função interna existente)
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-welcome-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
      body: JSON.stringify({
        to: sub.email,
        name: sub.name,
        role_label: `Aluno UNV IA Academy (plano ${planLabel})`,
        password: tempPassword || null,
        login_url: loginUrl,
      }),
    });
  } catch (e) {
    console.error("[ia-academy] email", e);
  }

  // WhatsApp via Evolution (se configurado)
  const apiUrl = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "").replace(/\/manager$/, "");
  const apiKey = Deno.env.get("EVOLUTION_API_KEY") || "";
  const instance = Deno.env.get("IA_ACADEMY_WA_INSTANCE") || Deno.env.get("EVOLUTION_INSTANCE") || "";
  const phone = String(sub.whatsapp || "").replace(/\D/g, "");
  if (!apiUrl || !apiKey || !instance || phone.length < 10) return;
  const number = phone.startsWith("55") ? phone : `55${phone}`;
  const text =
    `${firstName}, bora. Seu acesso ao UNV IA Academy está liberado.\n\n` +
    `Entrar: ${loginUrl}\n` +
    `Login: ${sub.email}` +
    (tempPassword ? `\nSenha inicial: ${tempPassword}` : "\nSenha: a que você criou no checkout") +
    `\n\nPrimeiro passo: dentro do Academy, abra "Encontros ao Vivo" e peça a sua sessão individual de planejamento com o Fabrício. ` +
    `Depois comece pela Trilha 0.\n\nQualquer dúvida, responde aqui.`;
  try {
    await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number, text }),
    });
  } catch (e) {
    console.error("[ia-academy] whatsapp", e);
  }
}

// ---------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------
async function handleCreate(sb: SupabaseClient, body: any) {
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const whatsapp = String(body.whatsapp || "").replace(/\D/g, "");
  const cpf = String(body.cpf || "").replace(/\D/g, "");
  const password = String(body.password || "");
  const plan = String(body.plan || "annual") as PlanKey;
  const paymentMethod = body.payment_method === "credit_card" ? "credit_card" : "pix";
  const companyName = String(body.company_name || "").trim() || null;
  const segment = String(body.segment || "").trim() || null;

  if (!name || !email) return j({ error: "Preencha nome e e-mail." }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return j({ error: "E-mail inválido." }, 400);
  if (whatsapp.length < 10) return j({ error: "Informe um WhatsApp válido com DDD." }, 400);
  if (!cpfValido(cpf)) return j({ error: "CPF inválido. Confira os números." }, 400);
  if (!PLANS[plan]) return j({ error: "Plano inválido." }, 400);
  if (!ASAAS_KEY) return j({ error: "Pagamento indisponível no momento (Asaas não configurado)." }, 500);

  // conta de acesso: reaproveita se o e-mail já existe, senão cria com a senha escolhida
  let userId: string | null = null;
  let existingAccount = false;
  const { data: found } = await sb.rpc("ia_academy_find_user_by_email", { p_email: email });
  if (found) {
    userId = found as string;
    existingAccount = true;
  } else {
    if (password.length < 6) return j({ error: "Crie uma senha com pelo menos 6 caracteres." }, 400);
    const { data: created, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, source: "ia_academy" },
    });
    if (error || !created?.user) return j({ error: "Não consegui criar sua conta: " + (error?.message || "erro") }, 400);
    userId = created.user.id;
  }

  // assinatura pendente reaproveitável (mesmo e-mail + plano, criada nas últimas 24h)
  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const { data: pending } = await sb
    .from("ia_academy_subscriptions")
    .select("*")
    .eq("email", email)
    .eq("plan", plan)
    .eq("status", "pending")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // já ativo? devolve direto
  const { data: active } = await sb
    .from("ia_academy_subscriptions")
    .select("id, access_token, crm_lead_id")
    .eq("email", email)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (active) return j({ already_paid: true, paid: true, subscription_id: active.id, token: active.access_token, existing_account: true });

  if (pending && pending.payment_method === paymentMethod && pending.asaas_payment_id) {
    return j({
      subscription_id: pending.id,
      pix_payload: pending.pix_payload,
      pix_qr_code_url: pending.pix_qr_code_base64 ? `data:image/png;base64,${pending.pix_qr_code_base64}` : null,
      invoice_url: pending.asaas_invoice_url,
      existing_account: existingAccount,
      amount_cents: pending.amount_cents,
      plan,
    });
  }

  const planCfg = PLANS[plan];

  // 1. cliente Asaas
  let customerId: string | null = null;
  const foundC = await asaas(`/customers?cpfCnpj=${cpf}`, "GET");
  if (foundC?.data?.length) customerId = foundC.data[0].id;
  if (!customerId) {
    const created = await asaas("/customers", "POST", {
      name, cpfCnpj: cpf, email, mobilePhone: whatsapp, notificationDisabled: true,
    });
    customerId = created.id;
  }

  // 2. registro local (antes do Asaas pra ter o id no externalReference)
  const { data: subRow, error: subErr } = await sb
    .from("ia_academy_subscriptions")
    .insert({
      name, email, whatsapp, cpf, company_name: companyName, segment,
      plan, amount_cents: planCfg.amount_cents, payment_method: paymentMethod,
      status: "pending", asaas_customer_id: customerId, user_id: userId,
      fbclid: body.fbclid || null, utm: body.utm && typeof body.utm === "object" ? body.utm : {},
    })
    .select("*")
    .single();
  if (subErr || !subRow) return j({ error: "Erro ao registrar assinatura: " + (subErr?.message || "?") }, 500);

  // 3. assinatura no Asaas
  const tomorrow = new Date(Date.now() + 24 * 3600000).toISOString().slice(0, 10);
  const asaasSub = await asaas("/subscriptions", "POST", {
    customer: customerId,
    billingType: paymentMethod === "credit_card" ? "CREDIT_CARD" : "PIX",
    value: planCfg.amount_cents / 100,
    cycle: planCfg.cycle,
    nextDueDate: tomorrow,
    description: planCfg.label,
    externalReference: `${EXT_REF_PREFIX}${subRow.id}`,
    notificationDisabled: true,
  });

  // 4. primeira cobrança: link e QR Code
  let invoiceUrl = "";
  let firstPaymentId = "";
  let pixPayload: string | null = null;
  let pixB64: string | null = null;
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const pays = await asaas(`/subscriptions/${asaasSub.id}/payments`, "GET");
    if (pays?.data?.length) {
      const first = pays.data[0];
      firstPaymentId = String(first.id || "");
      invoiceUrl = first.invoiceUrl || first.bankSlipUrl || (first.id ? `https://www.asaas.com/i/${first.id}` : "");
      if (paymentMethod === "pix" && first.id) {
        try {
          const qr = await asaas(`/payments/${first.id}/pixQrCode`, "GET");
          pixPayload = qr?.payload || null;
          pixB64 = qr?.encodedImage || null;
        } catch (e) {
          console.error("[ia-academy] pixQrCode", e);
        }
      }
    }
  } catch (e) {
    console.error("[ia-academy] payments", e);
  }

  await sb
    .from("ia_academy_subscriptions")
    .update({
      asaas_subscription_id: asaasSub.id,
      asaas_payment_id: firstPaymentId || null,
      asaas_invoice_url: invoiceUrl || null,
      pix_payload: pixPayload,
      pix_qr_code_base64: pixB64,
    })
    .eq("id", subRow.id);

  return j({
    subscription_id: subRow.id,
    pix_payload: pixPayload,
    pix_qr_code_url: pixB64 ? `data:image/png;base64,${pixB64}` : null,
    invoice_url: invoiceUrl || null,
    existing_account: existingAccount,
    amount_cents: planCfg.amount_cents,
    plan,
  });
}

async function handleStatus(sb: SupabaseClient, body: any) {
  const id = String(body.subscription_id || "");
  if (!id) return j({ error: "subscription_id obrigatório" }, 400);
  const { data: sub } = await sb.from("ia_academy_subscriptions").select("*").eq("id", id).maybeSingle();
  if (!sub) return j({ error: "Assinatura não encontrada" }, 404);

  if (sub.status === "active") {
    return j({ paid: true, status: sub.status, token: sub.access_token, crm_lead_id: sub.crm_lead_id });
  }

  // fallback ao webhook: consulta a 1ª cobrança direto no Asaas
  if (sub.asaas_payment_id && ASAAS_KEY) {
    try {
      const p = await asaas(`/payments/${sub.asaas_payment_id}`, "GET");
      if (isPaidStatus(p?.status)) {
        await activate(sb, sub, sub.asaas_payment_id);
        const { data: fresh } = await sb.from("ia_academy_subscriptions").select("access_token, crm_lead_id").eq("id", id).single();
        return j({ paid: true, status: "active", token: fresh?.access_token, crm_lead_id: fresh?.crm_lead_id });
      }
    } catch (e) {
      console.error("[ia-academy] status poll", e);
    }
  }
  return j({ paid: false, status: sub.status });
}

async function handleAsaasEvent(sb: SupabaseClient, body: any) {
  const payment = body.payment;
  const event = String(body.event || "");
  if (!payment) return j({ received: true, ignored: "no payment" });

  const ref = String(payment.externalReference || "");
  let sub: any = null;
  if (ref.startsWith(EXT_REF_PREFIX)) {
    const id = ref.slice(EXT_REF_PREFIX.length);
    const { data } = await sb.from("ia_academy_subscriptions").select("*").eq("id", id).maybeSingle();
    sub = data;
  }
  if (!sub && payment.subscription) {
    const { data } = await sb.from("ia_academy_subscriptions").select("*").eq("asaas_subscription_id", payment.subscription).maybeSingle();
    sub = data;
  }
  if (!sub) return j({ received: true, ignored: "not ia academy" });

  const status = String(payment.status || "");
  console.log(`[ia-academy] evento ${event} status=${status} sub=${sub.id}`);

  if (isPaidStatus(status)) {
    // 1ª cobrança ou renovação: ativa / estende o período
    await activate(sb, sub, payment.id);
    return j({ received: true, activated: true });
  }
  if (status === "OVERDUE" && sub.status === "active") {
    await sb.from("ia_academy_subscriptions").update({ status: "past_due" }).eq("id", sub.id);
    return j({ received: true, past_due: true });
  }
  if (["REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"].includes(status)) {
    await sb.from("ia_academy_subscriptions").update({ status: "refunded", cancelled_at: new Date().toISOString() }).eq("id", sub.id);
    if (sub.onboarding_user_id) await sb.from("academy_user_access").update({ is_active: false }).eq("onboarding_user_id", sub.onboarding_user_id);
    return j({ received: true, refunded: true });
  }
  if (["CANCELLED", "DELETED"].includes(status) && sub.status !== "pending") {
    await sb.from("ia_academy_subscriptions").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", sub.id);
    if (sub.onboarding_user_id) await sb.from("academy_user_access").update({ is_active: false }).eq("onboarding_user_id", sub.onboarding_user_id);
    return j({ received: true, cancelled: true });
  }
  return j({ received: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ error: "use POST" }, 405);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  let body: any;
  try { body = await req.json(); } catch { return j({ error: "JSON inválido" }, 400); }

  try {
    switch (body.action) {
      case "create": return await handleCreate(sb, body);
      case "status": return await handleStatus(sb, body);
      case "asaas_event": {
        // só a asaas-webhook (service role) pode disparar
        const auth = req.headers.get("authorization") || "";
        if (!auth.includes(SERVICE_ROLE)) return j({ error: "não autorizado" }, 401);
        return await handleAsaasEvent(sb, body);
      }
      default: return j({ error: "action inválida" }, 400);
    }
  } catch (e) {
    console.error("[ia-academy-checkout]", e);
    return j({ error: (e as Error).message || "Erro interno" }, 500);
  }
});
