import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Same normalization as evolution-api function
function normalizeBaseUrl(input: string) {
  return input.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
}

// Detect Stevo Manager V2 (*.stevo.chat)
function isManagerV2Url(input?: string | null): boolean {
  try {
    const hostname = new URL(String(input || "").replace(/\/+$/, "")).hostname.toLowerCase();
    return hostname.endsWith(".stevo.chat");
  } catch {
    return false;
  }
}

function buildEvolutionHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    "x-api-key": apiKey,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const diagnostics: Record<string, any> = {};

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fallback Evolution API credentials from env (used when instance has no api_url/api_key)
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

    // Parse request body to check if it's a manual execution
    let isManual = false;
    let pixAutoSimular = false;
    let soPixAuto = false;
    try {
      const body = await req.json();
      isManual = body?.manual === true;
      pixAutoSimular = body?.pix_auto_simular === true;
      soPixAuto = body?.so_pix_automatico === true || pixAutoSimular;
    } catch {
      // no body or invalid JSON — treat as scheduled
    }

    // Pix Automático (13/11/2026): link das parcelas vencidas e aviso de débito recusado no mesmo dia.
    // Roda toda hora, antes do filtro de horário das regras, e nunca derruba a régua.
    try {
      diagnostics.pix_automatico = await avisosPixAutomatico(supabase, pixAutoSimular, EVOLUTION_API_URL, EVOLUTION_API_KEY);
    } catch (e) {
      console.error("[billing-notifications] pix automático", e);
      diagnostics.pix_automatico = { erro: String((e as any)?.message || e) };
    }
    if (soPixAuto) {
      return new Response(JSON.stringify({ sent: 0, diagnostics }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Current UTC time for time-based filtering
    const nowUtc = new Date();
    const currentHourUtc = nowUtc.getUTCHours();
    const currentMinuteUtc = nowUtc.getUTCMinutes();
    diagnostics.current_hour_utc = currentHourUtc;
    diagnostics.current_minute_utc = currentMinuteUtc;
    diagnostics.is_manual = isManual;

    // 1. Load active billing rules
    const { data: allRules, error: rulesError } = await supabase
      .from("billing_notification_rules")
      .select("*")
      .eq("is_active", true);

    if (rulesError) throw rulesError;

    diagnostics.rules_count = allRules?.length ?? 0;

    // 2. Filter rules by scheduled send time (skip filter when manual)
    // Agente de Cobrança ligado (billing-agent): quem fala com cliente em atraso é ele, com
    // contexto e tom por faixa. A régua segue só com os lembretes de antes e do dia do
    // vencimento, pra o cliente não receber duas cobranças no mesmo dia.
    const { data: agentCfg } = await supabase
      .from("billing_agent_config")
      .select("enabled, dry_run, instance_id")
      .eq("id", true)
      .maybeSingle();
    const agenteCobra = !!(agentCfg?.enabled && !agentCfg?.dry_run && agentCfg?.instance_id);
    diagnostics.agente_cobranca_ativo = agenteCobra;

    let rules = (allRules || []).filter((r: any) => !(agenteCobra && r.trigger_type === "after"));
    const TIME_TOLERANCE_MINUTES = 5;

    if (!isManual && rules.length > 0) {
      const rulesScheduledNow: string[] = [];
      const rulesFilteredOut: string[] = [];

      rules = rules.filter((rule: any) => {
        const sendHour: number = rule.send_hour ?? 8;
        const sendMinute: number = rule.send_minute ?? 0;
        const tzOffset: number = rule.timezone_offset ?? -3;

        // Convert rule's local hour to UTC for comparison
        // local_hour = utc_hour + tz_offset  →  utc_hour = local_hour - tz_offset
        const targetUtcHour = ((sendHour - tzOffset) % 24 + 24) % 24;
        const targetUtcMinute = sendMinute;

        // Total minutes from midnight for comparison
        const currentTotal = currentHourUtc * 60 + currentMinuteUtc;
        const targetTotal = targetUtcHour * 60 + targetUtcMinute;
        const diff = Math.abs(currentTotal - targetTotal);

        // Handle midnight crossing (e.g. target=23:58, current=00:02)
        const wrappedDiff = Math.min(diff, 1440 - diff);

        const shouldFire = wrappedDiff <= TIME_TOLERANCE_MINUTES;
        if (shouldFire) {
          rulesScheduledNow.push(`${rule.name} (send_hour=${sendHour}, targetUtcHour=${targetUtcHour})`);
        } else {
          rulesFilteredOut.push(`${rule.name} (send_hour=${sendHour}, targetUtcHour=${targetUtcHour})`);
        }
        return shouldFire;
      });

      diagnostics.rules_filtered_by_time = rulesFilteredOut.length;
      diagnostics.rules_scheduled_now = rulesScheduledNow;
    } else {
      diagnostics.rules_filtered_by_time = 0;
      diagnostics.rules_scheduled_now = (rules || []).map((r: any) => r.name);
    }

    diagnostics.rules_after_time_filter = rules.length;

    if (!rules || rules.length === 0) {
      const msg = isManual
        ? "Nenhuma regra ativa encontrada"
        : `Nenhuma regra agendada para este horário (${currentHourUtc}:${String(currentMinuteUtc).padStart(2,"0")} UTC)`;
      return new Response(
        JSON.stringify({ sent: 0, message: msg, diagnostics }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Calculate target dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    const targetDates = new Set<string>();
    const ruleTargets: { rule_name: string; trigger: string; target_date: string }[] = [];

    for (const rule of rules) {
      const d = new Date(today);
      if (rule.trigger_type === "before") {
        d.setDate(d.getDate() + rule.days_offset);
      } else if (rule.trigger_type === "after") {
        d.setDate(d.getDate() - rule.days_offset);
      }
      const dateStr = d.toISOString().split("T")[0];
      targetDates.add(dateStr);
      ruleTargets.push({ rule_name: rule.name, trigger: rule.trigger_type, target_date: dateStr });
    }

    const targetDatesArray = [...targetDates];
    diagnostics.target_dates = targetDatesArray;
    diagnostics.rule_targets = ruleTargets;

    console.log(`[billing-notifications] Target dates: ${targetDatesArray.join(", ")}`);

    // 3. Get WhatsApp instances (all connected, including those without api_url)
    const { data: whatsappInstances } = await supabase
      .from("whatsapp_instances")
      .select("api_url, api_key, instance_name, is_default, status")
      .eq("status", "connected");

    diagnostics.whatsapp_instances_connected = (whatsappInstances || []).length;
    diagnostics.whatsapp_instances_detail = (whatsappInstances || []).map((i: any) => ({
      name: i.instance_name,
      has_api_url: !!i.api_url,
      has_api_key: !!i.api_key,
    }));

    // Build instance map, filling missing api_url/api_key from env fallback + normalize URL
    const instanceMap = new Map(
      (whatsappInstances || []).map((i: any) => {
        const rawUrl = i.api_url || EVOLUTION_API_URL;
        return [
          i.instance_name,
          {
            ...i,
            api_url: rawUrl ? normalizeBaseUrl(rawUrl) : rawUrl,
            api_key: i.api_key || EVOLUTION_API_KEY,
          },
        ];
      })
    );

    if (instanceMap.size === 0) {
      diagnostics.stop_reason = "no_whatsapp_instance_connected";
      return new Response(
        JSON.stringify({
          sent: 0,
          error: "Nenhuma instância WhatsApp conectada. Conecte uma instância em Configurações → WhatsApp.",
          diagnostics,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if any instance has usable credentials
    const usableInstances = [...instanceMap.values()].filter((i: any) => i.api_url && i.api_key);
    diagnostics.whatsapp_instances_usable = usableInstances.length;

    if (usableInstances.length === 0) {
      diagnostics.stop_reason = "instances_missing_api_credentials";
      return new Response(
        JSON.stringify({
          sent: 0,
          error: "Instâncias conectadas mas sem api_url/api_key. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY nos secrets do Supabase, ou edite a instância.",
          diagnostics,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Load invoices matching target dates
    const { data: invoices, error: invError } = await supabase
      .from("company_invoices")
      .select(`
        id, amount_cents, description, due_date, status,
        payment_link_url, daily_interest_percent, late_fee_percent,
        late_fee_cents, interest_cents, installment_number,
        total_installments, company_id, recurring_charge_id, send_whatsapp, auto_debit
      `)
      .in("status", ["pending", "overdue"])
      .in("due_date", targetDatesArray)
      .neq("send_whatsapp", false);

    if (invError) throw invError;

    diagnostics.invoices_found = invoices?.length ?? 0;

    if (!invoices || invoices.length === 0) {
      diagnostics.stop_reason = "no_invoices_for_target_dates";
      return new Response(
        JSON.stringify({
          sent: 0,
          message: `Nenhuma fatura pendente/atrasada encontrada para as datas: ${targetDatesArray.join(", ")}`,
          diagnostics,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[billing-notifications] Found ${invoices.length} invoices`);

    // 4b. Try to fetch Asaas payment links for invoices missing one
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || "";
    if (ASAAS_API_KEY) {
      // Pix Automático (09/11/2026, Fabrício: "o cliente não pode receber link de pagamento, ele tem que
      // receber um aviso que vai descontar, só isso, e se atrasar aí sim receber cobrança"): fatura com
      // auto_debit só ganha link depois do vencimento, e o link é o da própria cobrança do Asaas (que já
      // está vencida), pra pagar a mesma parcela sem duplicar com a nova tentativa de débito.
      const needsLink = invoices.filter(
        (inv: any) => (!inv.payment_link_url || !inv.payment_link_url.includes("asaas")) && inv.recurring_charge_id
          && (!inv.auto_debit || inv.due_date < todayStr)
      );
      for (const inv of needsLink.slice(0, 10)) {
        try {
          const { data: charge } = await supabase
            .from("company_recurring_charges")
            .select("pagarme_plan_id, asaas_account_id")
            .eq("id", inv.recurring_charge_id)
            .single();

          let apiKeyToUse = ASAAS_API_KEY;
          if (charge?.asaas_account_id) {
            const { data: account } = await supabase
              .from("asaas_accounts")
              .select("api_key_secret_name")
              .eq("id", charge.asaas_account_id)
              .single();
            if (account?.api_key_secret_name) {
              const resolvedKey = Deno.env.get(account.api_key_secret_name);
              if (resolvedKey) apiKeyToUse = resolvedKey;
            }
          }

          if (charge?.pagarme_plan_id) {
            const subsResp = await fetch(
              `https://api.asaas.com/v3/subscriptions/${charge.pagarme_plan_id}/payments?${inv.auto_debit ? "" : "status=PENDING&"}dueDate=${inv.due_date}`,
              { headers: { "access_token": apiKeyToUse } }
            );
            if (subsResp.ok) {
              const subsData = await subsResp.json();
              const payment = inv.auto_debit
                ? (subsData.data || []).find((p: any) => ["PENDING", "OVERDUE"].includes(p.status))
                : subsData.data?.[0];
              if (payment?.invoiceUrl) {
                inv.payment_link_url = payment.invoiceUrl;
                await supabase.from("company_invoices")
                  .update({ payment_link_url: payment.invoiceUrl })
                  .eq("id", inv.id);
              }
            } else {
              await subsResp.text();
            }
          }
        } catch (e) {
          console.error(`[billing-notifications] Error fetching Asaas URL for invoice ${inv.id}:`, e);
        }
      }
    }

    // 5. Load companies
    const companyIds = [...new Set(invoices.map((i: any) => i.company_id))];
    const { data: companies } = await supabase
      .from("onboarding_companies")
      .select("id, name, phone, email")
      .in("id", companyIds);

    const companyMap = new Map((companies || []).map((c: any) => [c.id, c]));

    const companiesWithoutPhone = (companies || []).filter((c: any) => !c.phone || c.phone.replace(/\D/g, "").length < 10);
    diagnostics.companies_without_phone = companiesWithoutPhone.map((c: any) => c.name);

    // 6. Check already sent today
    const { data: sentToday } = await supabase
      .from("billing_notification_logs")
      .select("rule_id, invoice_id")
      .gte("sent_at", todayStr + "T00:00:00")
      .eq("status", "sent");

    const sentKeys = new Set((sentToday || []).map((s: any) => `${s.rule_id}:${s.invoice_id}`));
    diagnostics.already_sent_today = sentToday?.length ?? 0;

    let totalSent = 0;
    const sendQueue: any[] = [];
    const skippedReasons: string[] = [];

    // Pix Automático (auto_debit, mensalidade do UNV Sales, 17/10/2026): antes e no dia do
    // vencimento o cliente recebe só o lembrete de que vai debitar, sem link e sem a oferta de
    // desconto pra pagar hoje, e no máximo um por dia (várias regras caem no mesmo dia).
    // Depois do vencimento (o débito não passou) segue a régua normal, com o link.
    const autoDebitoHoje = new Set<string>((sentToday || []).map((s: any) => String(s.invoice_id)));

    for (const rule of rules) {
      const d = new Date(today);
      let targetDate: string;

      if (rule.trigger_type === "before") {
        d.setDate(d.getDate() + rule.days_offset);
        targetDate = d.toISOString().split("T")[0];
      } else if (rule.trigger_type === "on_due") {
        targetDate = todayStr;
      } else {
        d.setDate(d.getDate() - rule.days_offset);
        targetDate = d.toISOString().split("T")[0];
      }

      const matchingInvoices = invoices.filter((inv: any) => inv.due_date === targetDate);

      for (const invoice of matchingInvoices) {
        const key = `${rule.id}:${invoice.id}`;

        if (sentKeys.has(key)) {
          skippedReasons.push(`[${invoice.id}] já enviado hoje`);
          continue;
        }

        const company = companyMap.get(invoice.company_id);
        if (!company?.phone) {
          skippedReasons.push(`[${invoice.company_id}] sem telefone cadastrado`);
          continue;
        }

        const cleanPhone = company.phone.replace(/\D/g, "");
        if (!cleanPhone || cleanPhone.length < 10) {
          skippedReasons.push(`[${company.name}] telefone inválido: ${company.phone}`);
          continue;
        }

        const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

        // Resolve WhatsApp instance — rule.whatsapp_instance_name → fallback to any usable instance
        const preferredName = rule.whatsapp_instance_name;
        let whatsappInstance = preferredName ? instanceMap.get(preferredName) : null;
        if (!whatsappInstance?.api_url || !whatsappInstance?.api_key) {
          whatsappInstance = usableInstances[0];
        }

        if (!whatsappInstance?.api_url || !whatsappInstance?.api_key) {
          skippedReasons.push(`[${company.name}] instância WhatsApp sem credenciais`);
          continue;
        }

        let message: string;
        // Pix Automático (13/11/2026, Fabrício: "o primeiro tem que enviar, as parcelas restantes não"):
        // a 1ª parcela é a que ativa a autorização e é paga pelo link, então segue a régua com o link
        // (texto próprio, sem a oferta de desconto, que o QR não dá). No máximo uma por dia.
        const ativacaoPix = !!invoice.auto_debit && String(invoice.payment_link_url || "").includes("/pix-automatico/");
        if (ativacaoPix) {
          if (autoDebitoHoje.has(String(invoice.id))) {
            skippedReasons.push(`[${company.name}] Pix Automático: lembrete da 1ª parcela já enviado hoje`);
            continue;
          }
          autoDebitoHoje.add(String(invoice.id));
          message = buildPixActivationMessage(rule, invoice, company);
        } else if (invoice.auto_debit && (rule.trigger_type === "before" || rule.trigger_type === "on_due")) {
          if (autoDebitoHoje.has(String(invoice.id))) {
            skippedReasons.push(`[${company.name}] Pix Automático: lembrete de débito já enviado hoje`);
            continue;
          }
          autoDebitoHoje.add(String(invoice.id));
          message = buildAutoDebitMessage(rule, invoice, company);
        } else if (invoice.auto_debit && !String(invoice.payment_link_url || "").includes("asaas")) {
          // atrasou mas o Asaas ainda não devolveu a cobrança vencida: sem link não manda cobrança vazia
          skippedReasons.push(`[${company.name}] Pix Automático vencido sem link da cobrança no Asaas`);
          continue;
        } else {
          message = buildMessage(rule, invoice, company, today);
        }

        sendQueue.push({
          rule, invoice, company, formattedPhone, message,
          instanceName: whatsappInstance.instance_name,
          apiUrl: normalizeBaseUrl(whatsappInstance.api_url),
          apiKey: whatsappInstance.api_key,
        });
      }
    }

    diagnostics.queue_size = sendQueue.length;
    diagnostics.skipped = skippedReasons;

    console.log(`[billing-notifications] Queue: ${sendQueue.length} messages`);

    if (sendQueue.length === 0) {
      return new Response(
        JSON.stringify({
          sent: 0,
          total: 0,
          message: "Nenhuma mensagem para enviar. Verifique os diagnósticos.",
          diagnostics,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send in parallel batches of 5
    const BATCH_SIZE = 5;
    const TIMEOUT_MS = 10000;
    const failures: string[] = [];

    for (let i = 0; i < sendQueue.length; i += BATCH_SIZE) {
      const batch = sendQueue.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
          try {
            // Manager V2 (Stevo *.stevo.chat): POST /send/text — no instance in path
            // Evolution API (standard): POST /message/sendText/{instanceName}
            const isV2 = isManagerV2Url(item.apiUrl);
            const sendUrl = isV2
              ? `${item.apiUrl}/send/text`
              : `${item.apiUrl}/message/sendText/${item.instanceName}`;
            const sendHeaders = isV2
              ? { "Content-Type": "application/json", apikey: item.apiKey }
              : buildEvolutionHeaders(item.apiKey);

            const resp = await fetch(sendUrl, {
                method: "POST",
                headers: sendHeaders,
                body: JSON.stringify({ number: item.formattedPhone, text: item.message }),
                signal: controller.signal,
              });
            clearTimeout(timeout);
            const body = await resp.text();
            return { ...item, ok: resp.ok, body };
          } catch (e: any) {
            clearTimeout(timeout);
            return { ...item, ok: false, body: e?.message || "timeout" };
          }
        })
      );

      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        const val = r.status === "fulfilled" ? r.value : { ...batch[j], ok: false, body: "rejected" };

        if (val.ok) {
          totalSent++;
          console.log(`[billing-notifications] ✓ ${val.company.name} (${val.formattedPhone})`);
        } else {
          const isV2err = isManagerV2Url(val.apiUrl);
        const usedUrl = isV2err ? `${val.apiUrl}/send/text` : `${val.apiUrl}/message/sendText/${val.instanceName}`;
        const errMsg = `${val.company.name} (${val.formattedPhone}): ${val.body} [url: ${usedUrl}]`;
          failures.push(errMsg);
          console.error(`[billing-notifications] ✗ ${errMsg}`);
        }

        await supabase.from("billing_notification_logs").insert({
          rule_id: val.rule.id,
          invoice_id: val.invoice.id,
          company_id: val.invoice.company_id,
          phone: val.formattedPhone,
          message_sent: val.message,
          status: val.ok ? "sent" : "failed",
        });
      }
    }

    diagnostics.failures = failures;
    console.log(`[billing-notifications] Total sent: ${totalSent}/${sendQueue.length}`);

    return new Response(
      JSON.stringify({ sent: totalSent, total: sendQueue.length, diagnostics }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("billing-notifications error:", error);
    return new Response(
      JSON.stringify({ error: (error as any).message, diagnostics }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** Lembrete de Pix Automático: o valor sai sozinho da conta do cliente no vencimento. */
function buildAutoDebitMessage(rule: any, invoice: any, company: any): string {
  const valor = (invoice.amount_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const [a, m, d] = String(invoice.due_date).split("-");
  const quando = rule.trigger_type === "on_due" ? "*hoje*" : `no dia *${d}/${m}/${a}*`;
  return `Olá ${company.name || ""}! 👋\n\n` +
    `Passando pra lembrar que ${quando} a sua mensalidade será debitada automaticamente pelo *Pix Automático*:\n\n` +
    `📄 *${invoice.description || "Mensalidade"}*\n💰 *Valor:* ${valor}\n\n` +
    `Você não precisa fazer nada, é só manter o saldo disponível na conta. Qualquer dúvida, é só responder esta mensagem.`;
}

function buildMessage(rule: any, invoice: any, company: any, today: Date): string {
  const amountBRL = (invoice.amount_cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const dueDateParts = invoice.due_date.split("-");
  const dueDateFormatted = `${dueDateParts[2]}/${dueDateParts[1]}/${dueDateParts[0]}`;
  const dueDate = new Date(invoice.due_date + "T00:00:00");

  let interestAmount = 0;
  let lateFeeAmount = 0;
  let totalUpdated = invoice.amount_cents;

  if (today > dueDate) {
    const daysLate = Math.floor(
      (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const dailyInterest = invoice.daily_interest_percent || 0.033;
    interestAmount = Math.round(
      invoice.amount_cents * (dailyInterest / 100) * daysLate
    );
    const lateFeePercent = invoice.late_fee_percent || 2;
    lateFeeAmount = Math.round(invoice.amount_cents * (lateFeePercent / 100));
    totalUpdated = invoice.amount_cents + interestAmount + lateFeeAmount;
  }

  const discountPercent = 5;
  const discountAmount = Math.round(invoice.amount_cents * (discountPercent / 100));
  const totalWithDiscount = invoice.amount_cents - discountAmount;

  const formatBRL = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const parcela =
    invoice.installment_number && invoice.total_installments
      ? `${invoice.installment_number}/${invoice.total_installments}`
      : "";

  let msg = rule.message_template;
  msg = msg.replace(/\{\{nome_cliente\}\}/g, company.name || "");
  msg = msg.replace(/\{\{valor\}\}/g, amountBRL);
  msg = msg.replace(/\{\{vencimento\}\}/g, dueDateFormatted);
  msg = msg.replace(/\{\{descricao\}\}/g, invoice.description || "Fatura");
  msg = msg.replace(/\{\{link_pagamento\}\}/g, invoice.payment_link_url || "");
  msg = msg.replace(/\{\{juros\}\}/g, formatBRL(interestAmount));
  msg = msg.replace(/\{\{multa\}\}/g, formatBRL(lateFeeAmount));
  msg = msg.replace(/\{\{total_atualizado\}\}/g, formatBRL(totalUpdated));
  msg = msg.replace(/\{\{desconto\}\}/g, formatBRL(discountAmount));
  msg = msg.replace(/\{\{total_com_desconto\}\}/g, formatBRL(totalWithDiscount));
  msg = msg.replace(/\{\{parcela\}\}/g, parcela);

  return msg;
}

/** 1ª parcela do Pix Automático: é paga pelo link, e o mesmo pagamento autoriza os débitos seguintes. */
function buildPixActivationMessage(rule: any, invoice: any, company: any): string {
  const valor = (invoice.amount_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const [a, m, d] = String(invoice.due_date).split("-");
  const quando = rule.trigger_type === "on_due" ? "vence *hoje*"
    : rule.trigger_type === "after" ? `venceu no dia *${d}/${m}/${a}*`
    : `vence no dia *${d}/${m}/${a}*`;
  return `Olá ${company.name || ""}! 👋\n\n` +
    `Passando pra lembrar que a 1ª parcela da sua mensalidade ${quando}. É só pagar pelo link abaixo, e no mesmo pagamento o seu banco pede pra autorizar o *Pix Automático* das próximas:\n\n` +
    `📄 *${invoice.description || "Mensalidade"}*\n💰 *Valor:* ${valor}\n\n` +
    `🔗 ${invoice.payment_link_url}\n\n` +
    `Qualquer dúvida, é só responder esta mensagem.`;
}

/** Chave da conta Asaas da recorrência (mesma ordem das funções que criam a cobrança). */
async function chaveAsaasDaRecorrencia(supabase: any, asaasAccountId?: string | null): Promise<string> {
  if (asaasAccountId) {
    const { data: porRef } = await supabase.from("tenant_integration_secrets")
      .select("secret_value").eq("provider", "asaas").eq("reference_id", asaasAccountId).limit(1);
    if (porRef?.[0]?.secret_value) return String(porRef[0].secret_value);
    const { data: acc } = await supabase.from("asaas_accounts").select("api_key_secret_name").eq("id", asaasAccountId).maybeSingle();
    if (acc?.api_key_secret_name) {
      const { data: porNome } = await supabase.from("tenant_integration_secrets")
        .select("secret_value").eq("secret_name", acc.api_key_secret_name).limit(1);
      const k = (porNome?.[0]?.secret_value as string) || Deno.env.get(acc.api_key_secret_name) || "";
      if (k) return k;
    }
  }
  return Deno.env.get("ASAAS_API_KEY") || "";
}

async function asaasGet(key: string, path: string): Promise<any> {
  const r = await fetch(`https://api.asaas.com/v3${path}`, { headers: { access_token: key } });
  const t = await r.text();
  if (!r.ok) throw new Error(`Asaas HTTP ${r.status}`);
  try { return t ? JSON.parse(t) : {}; } catch { return {}; }
}

/**
 * Pix Automático, da 2ª parcela em diante (13/11/2026, Fabrício: "deixa descontar, se atrasar 1 dia aí já
 * avisa" e "se o pix for feito pela manhã, a tarde já tem que ser avisado que não descontou"):
 *  1) parcela vencida ganha o link da cobrança do Asaas, senão o agente de cobrança pula por falta de link;
 *  2) tentativa de débito recusada (gravada pelo asaas-webhook em pix_automatico_recusas) vira aviso pro
 *     cliente no mesmo dia, entre 8h e 20h, pela instância padrão do financeiro, um por parcela por dia.
 */
async function avisosPixAutomatico(supabase: any, simular: boolean, envUrl: string, envKey: string) {
  const out: Record<string, any> = { links: [], avisos: [] };
  const agora = new Date();
  const br = new Date(agora.getTime() - 3 * 3600000);
  const hojeBR = br.toISOString().slice(0, 10);
  const horaBR = br.getUTCHours();

  const linkDaParcela = async (inv: any, paymentId?: string | null): Promise<{ url: string | null; paga: boolean }> => {
    const { data: charge } = await supabase.from("company_recurring_charges")
      .select("pagarme_plan_id, asaas_account_id").eq("id", inv.recurring_charge_id).maybeSingle();
    const key = await chaveAsaasDaRecorrencia(supabase, charge?.asaas_account_id);
    if (!key) return { url: null, paga: false };
    const pagos = ["RECEIVED", "RECEIVED_IN_CASH", "CONFIRMED"];
    if (paymentId) {
      try {
        const p = await asaasGet(key, `/payments/${paymentId}`);
        if (pagos.includes(String(p?.status))) return { url: null, paga: true };
        if (p?.invoiceUrl) return { url: String(p.invoiceUrl), paga: false };
      } catch (e) { console.error("[pix-auto] payment", paymentId, String((e as any)?.message || e)); }
    }
    if (charge?.pagarme_plan_id) {
      const lista = await asaasGet(key, `/subscriptions/${charge.pagarme_plan_id}/payments?dueDate=${inv.due_date}`);
      const todos = lista?.data || [];
      const aberto = todos.find((p: any) => ["PENDING", "OVERDUE"].includes(String(p.status)));
      if (aberto?.invoiceUrl) return { url: String(aberto.invoiceUrl), paga: false };
      if (todos.length && todos.every((p: any) => pagos.includes(String(p.status)))) return { url: null, paga: true };
    }
    return { url: null, paga: false };
  };

  // 1) Link das parcelas de Pix Automático já vencidas (até 60 dias)
  const de = new Date(br.getTime() - 60 * 86400000).toISOString().slice(0, 10);
  const { data: vencidas } = await supabase.from("company_invoices")
    .select("id, due_date, payment_link_url, recurring_charge_id, company_id")
    .eq("auto_debit", true).in("status", ["pending", "overdue"]).is("paid_at", null)
    .lt("due_date", hojeBR).gte("due_date", de).not("recurring_charge_id", "is", null)
    .order("due_date", { ascending: true }).limit(50);
  const semLink = (vencidas || []).filter((i: any) => {
    const l = String(i.payment_link_url || "");
    return !l.includes("asaas") && !l.includes("/pix-automatico/");
  }).slice(0, 10);
  for (const inv of semLink) {
    try {
      const { url } = await linkDaParcela(inv);
      if (url && !simular) await supabase.from("company_invoices").update({ payment_link_url: url }).eq("id", inv.id);
      out.links.push({ invoice_id: inv.id, vencimento: inv.due_date, achou: !!url });
    } catch (e) {
      out.links.push({ invoice_id: inv.id, erro: String((e as any)?.message || e) });
    }
  }

  // 2) Aviso de débito recusado
  if (!simular && (horaBR < 8 || horaBR >= 20)) { out.fora_do_horario = true; return out; }
  const { data: recusas, error: recErr } = await supabase.from("pix_automatico_recusas")
    .select("*").eq("aviso_status", "pendente")
    .gte("recebido_em", new Date(agora.getTime() - 3 * 86400000).toISOString())
    .order("recebido_em", { ascending: true }).limit(20);
  if (recErr) { out.erro_recusas = recErr.message; return out; }
  if (!recusas?.length) return out;

  const { data: agentCfg } = await supabase.from("billing_agent_config").select("enabled, dry_run, instance_id").eq("id", true).maybeSingle();
  const agenteCobra = !!(agentCfg?.enabled && !agentCfg?.dry_run && agentCfg?.instance_id);
  const { data: defCfg } = await supabase.from("whatsapp_default_config").select("setting_value").eq("setting_key", "default_instance").maybeSingle();
  const { data: inst } = defCfg?.setting_value
    ? await supabase.from("whatsapp_instances").select("api_url, api_key, instance_name").eq("status", "connected").eq("instance_name", defCfg.setting_value).maybeSingle()
    : { data: null };
  const apiUrl = normalizeBaseUrl(String(inst?.api_url || envUrl || ""));
  const apiKey = String(inst?.api_key || envKey || "");

  const fechar = async (r: any, status: string, motivo: string, extra: Record<string, unknown> = {}) => {
    out.avisos.push({ instrucao: r.id, status, motivo, ...(extra.preview ? { preview: extra.preview } : {}), ...(extra.telefone ? { telefone: extra.telefone } : {}) });
    if (simular) return;
    const patch: Record<string, unknown> = { aviso_status: status, aviso_motivo: motivo.slice(0, 300), avisado_em: new Date().toISOString() };
    if (extra.invoice_id) patch.invoice_id = extra.invoice_id;
    await supabase.from("pix_automatico_recusas").update(patch).eq("id", r.id);
  };

  const avisadasAgora = new Set<string>();
  for (const r of recusas) {
    try {
      const { data: pa } = r.authorization_id
        ? await supabase.from("asaas_pix_automatico").select("id, recurring_charge_id, company_id").eq("id", r.authorization_id).maybeSingle()
        : { data: null };
      const recId = r.recurring_charge_id || pa?.recurring_charge_id;
      if (!recId) { await fechar(r, "dispensado", "autorização sem recorrência do Nexus"); continue; }

      const campos = "id, amount_cents, description, due_date, status, paid_at, payment_link_url, company_id, recurring_charge_id, send_whatsapp, auto_debit, installment_number";
      let inv: any = null;
      if (r.invoice_id) inv = (await supabase.from("company_invoices").select(campos).eq("id", r.invoice_id).maybeSingle()).data;
      if (!inv && r.due_date) inv = (await supabase.from("company_invoices").select(campos).eq("recurring_charge_id", recId).eq("due_date", r.due_date).limit(1).maybeSingle()).data;
      if (!inv) {
        const limite = new Date(br.getTime() - 10 * 86400000).toISOString().slice(0, 10);
        inv = (await supabase.from("company_invoices").select(campos).eq("recurring_charge_id", recId)
          .in("status", ["pending", "overdue"]).is("paid_at", null).gte("due_date", limite)
          .order("due_date", { ascending: true }).limit(1).maybeSingle()).data;
      }
      if (!inv) { await fechar(r, "dispensado", "parcela não encontrada"); continue; }
      const idInv = { invoice_id: inv.id };
      if (inv.paid_at || !["pending", "overdue"].includes(String(inv.status))) { await fechar(r, "dispensado", "parcela já paga ou cancelada", idInv); continue; }
      if (inv.send_whatsapp === false) { await fechar(r, "dispensado", "parcela com WhatsApp desligado", idInv); continue; }
      if (String(inv.payment_link_url || "").includes("/pix-automatico/")) { await fechar(r, "dispensado", "1ª parcela, segue a régua com o link de ativação", idInv); continue; }

      // Link da cobrança no Asaas, pra quem quiser pagar na hora
      let link = String(inv.payment_link_url || "").includes("asaas") ? String(inv.payment_link_url) : "";
      try {
        const achado = await linkDaParcela(inv, r.payment_id);
        if (achado.paga) { await fechar(r, "dispensado", "cobrança já consta paga no Asaas", idInv); continue; }
        if (achado.url) {
          link = achado.url;
          if (!simular && link !== inv.payment_link_url) await supabase.from("company_invoices").update({ payment_link_url: link }).eq("id", inv.id);
        }
      } catch (e) { console.error("[pix-auto] link", inv.id, String((e as any)?.message || e)); }

      if (inv.due_date < hojeBR && agenteCobra) { await fechar(r, "dispensado", "parcela já vencida, o agente de cobrança assume", idInv); continue; }

      // Um aviso por parcela por dia (o banco pode tentar mais de uma vez)
      if (avisadasAgora.has(String(inv.id))) { await fechar(r, "dispensado", "parcela já avisada hoje", idInv); continue; }
      const { data: jaHoje } = await supabase.from("pix_automatico_recusas").select("id")
        .eq("invoice_id", inv.id).eq("aviso_status", "enviado").gte("avisado_em", `${hojeBR}T03:00:00Z`).limit(1);
      if (jaHoje?.length) { await fechar(r, "dispensado", "parcela já avisada hoje", idInv); continue; }

      const { data: company } = await supabase.from("onboarding_companies").select("id, name, phone").eq("id", inv.company_id).maybeSingle();
      let fone = String(company?.phone || "").replace(/\D/g, "");
      if (fone.length < 10) {
        const { data: ch } = await supabase.from("company_recurring_charges").select("customer_phone").eq("id", recId).maybeSingle();
        fone = String(ch?.customer_phone || "").replace(/\D/g, "");
      }
      if (fone.length < 10) { await fechar(r, "falhou", "empresa sem telefone válido", idInv); continue; }
      if (!fone.startsWith("55")) fone = `55${fone}`;

      const valor = (inv.amount_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const [a, m, d] = String(inv.due_date).split("-");
      const message = `Olá ${company?.name || ""}! 👋\n\n` +
        `Passando pra avisar que o débito da sua mensalidade pelo *Pix Automático* não foi concluído hoje:\n\n` +
        `📄 *${inv.description || "Mensalidade"}*\n💰 *Valor:* ${valor}\n📅 *Vencimento:* ${d}/${m}/${a}\n\n` +
        `Normalmente é saldo ou limite do Pix na conta. O banco tenta de novo nos próximos dias, então vale conferir.` +
        (link ? `\n\nSe preferir resolver agora, é só pagar por aqui:\n🔗 ${link}` : "") +
        `\n\nQualquer dúvida, é só responder esta mensagem.`;

      if (simular) { await fechar(r, "simulado", "prévia, nada enviado", { ...idInv, preview: message, telefone: fone }); continue; }
      if (!apiUrl || !apiKey || !inst?.instance_name) { out.avisos.push({ instrucao: r.id, status: "pendente", motivo: "instância do financeiro desconectada, tenta na próxima hora" }); continue; }

      const isV2 = isManagerV2Url(apiUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let ok = false; let corpo = "";
      try {
        const resp = await fetch(isV2 ? `${apiUrl}/send/text` : `${apiUrl}/message/sendText/${inst.instance_name}`, {
          method: "POST",
          headers: isV2 ? { "Content-Type": "application/json", apikey: apiKey } : buildEvolutionHeaders(apiKey),
          body: JSON.stringify({ number: fone, text: message }),
          signal: controller.signal,
        });
        ok = resp.ok; corpo = (await resp.text()).slice(0, 200);
      } catch (e: any) { corpo = e?.message || "timeout"; }
      clearTimeout(timeout);

      await supabase.from("billing_notification_logs").insert({
        rule_id: null, invoice_id: inv.id, company_id: inv.company_id, phone: fone, message_sent: message, status: ok ? "sent" : "failed",
      });
      if (ok) {
        avisadasAgora.add(String(inv.id));
        await fechar(r, "enviado", "aviso de débito recusado enviado", { ...idInv, telefone: fone });
      } else {
        // falha de envio: tenta de novo na próxima hora, até 3 vezes
        const tent = Number(r.tentativas || 0) + 1;
        if (tent >= 3) await fechar(r, "falhou", `falha no envio (3 tentativas): ${corpo}`, { ...idInv, telefone: fone });
        else {
          await supabase.from("pix_automatico_recusas").update({ tentativas: tent, aviso_motivo: `falha no envio: ${corpo}`.slice(0, 300), invoice_id: inv.id }).eq("id", r.id);
          out.avisos.push({ instrucao: r.id, status: "pendente", motivo: `falha no envio, tentativa ${tent} de 3` });
        }
      }
      console.log(`[billing-notifications] Pix Automático recusado: ${company?.name} ${ok ? "avisado" : "FALHOU"}`);
    } catch (e) {
      console.error("[billing-notifications] recusa", r.id, e);
      out.avisos.push({ instrucao: r.id, status: "erro", motivo: String((e as any)?.message || e) });
    }
  }
  return out;
}
