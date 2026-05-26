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

    // 1. Load active billing rules
    const { data: rules, error: rulesError } = await supabase
      .from("billing_notification_rules")
      .select("*")
      .eq("is_active", true);

    if (rulesError) throw rulesError;

    diagnostics.rules_count = rules?.length ?? 0;

    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "Nenhuma regra ativa encontrada", diagnostics }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Calculate target dates
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
        total_installments, company_id, recurring_charge_id, send_whatsapp
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
      const needsLink = invoices.filter(
        (inv: any) => (!inv.payment_link_url || !inv.payment_link_url.includes("asaas")) && inv.recurring_charge_id
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
              `https://api.asaas.com/v3/subscriptions/${charge.pagarme_plan_id}/payments?status=PENDING&dueDate=${inv.due_date}`,
              { headers: { "access_token": apiKeyToUse } }
            );
            if (subsResp.ok) {
              const subsData = await subsResp.json();
              const payment = subsData.data?.[0];
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

        const message = buildMessage(rule, invoice, company, today);

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
