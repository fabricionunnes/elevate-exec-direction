import { createClient } from "@supabase/supabase-js";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key"
};
const PIPELINE_ID = "d75962f6-4369-4d92-9386-52d477602149"; // MANSÃO EMPREENDEDORA
const STAGE_ENTRADA = "79e7818f-d949-4980-8a60-0595c8b22cc3";
const STAGE_COMPROU = "80c7b37d-2630-49ee-9d87-f209faa91f7a";
const NOTIFY_PHONE = "5531989840003"; // Fabrício
const NOTIFY_INSTANCE = "fabricionunnes";
// Financeiro: contas a receber + saldo do banco (financial_banks)
const BANK_ASAAS = "6e9a3135-5826-4633-adf1-a63ef5b70e96"; // Asaas (ativo)
const BANK_MERCADOPAGO = "50d90f6e-e8e6-4dd7-87e9-3757ccda9842"; // Mercado pago
const CATEGORY_EVENTOS = "c0a1e5e0-0000-4000-8000-00000000e7e7"; // financial_categories: Eventos (income)
const PROVIDER_FEE_RATE = 0.0199; // 1,99% descontado pelo provedor
const EVENT_LABEL = {
  "junho-2026": "Setembro 2026",
  "outubro-2026": "GP Outubro 2026",
  "maio-2026": "Maio 2026",
  "abril-2026": "Abril 2026"
};
const FALLBACK_TOKEN = "656a7068f01d8920fe9167279dcb14d19d7b6d09cb9bbcc7";
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response(null, {
    headers: corsHeaders
  });
  try {
    const expected = Deno.env.get("MANSAO_HOOK_TOKEN") || FALLBACK_TOKEN;
    if (req.headers.get("x-api-key") !== expected) {
      return new Response(JSON.stringify({
        error: "Unauthorized"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const { name, phone, email, status, amount, method, installments, orderId, provider, eventKey, tracking } = await req.json();
    // Origem do anúncio (capturada no navegador do site e enviada pelo checkout)
    const trk = tracking && typeof tracking === "object" ? tracking : {};
    const s = (k)=>{ const v = trk[k]; return v == null || v === "" ? null : String(v).slice(0, 200); };
    const trkCols = {
      utm_source: s("utm_source"), utm_medium: s("utm_medium"), utm_campaign: s("utm_campaign"),
      utm_content: s("utm_content"), utm_term: s("utm_term"), fbclid: s("fbclid"),
      ad_name: s("ad_name"), adset_name: s("adset_name"), campaign_name: s("campaign_name"),
      meta_ad_id: s("ad_id") ?? s("meta_ad_id"), meta_adset_id: s("adset_id") ?? s("meta_adset_id"), meta_campaign_id: s("campaign_id") ?? s("meta_campaign_id"),
    };
    const temTracking = Object.values(trkCols).some((v)=>v);
    if (!name || !status) {
      return new Response(JSON.stringify({
        error: "name e status obrigatórios"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    // Normaliza telefone: só dígitos, sem DDI 55
    let digits = String(phone || "").replace(/\D/g, "");
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
    // Procura lead existente no funil da Mansão (pelos últimos 8 dígitos do fone ou email)
    let lead = null;
    if (digits.length >= 8) {
      const { data } = await supabase.from("crm_leads").select("id, stage_id, notes, utm_source, fbclid, meta_ad_id").eq("pipeline_id", PIPELINE_ID).ilike("phone", `%${digits.slice(-8)}`).limit(1);
      lead = data?.[0] ?? null;
    }
    if (!lead && email) {
      const { data } = await supabase.from("crm_leads").select("id, stage_id, notes, utm_source, fbclid, meta_ad_id").eq("pipeline_id", PIPELINE_ID).ilike("email", email).limit(1);
      lead = data?.[0] ?? null;
    }
    const isPaid = status === "paid";
    const targetStage = isPaid ? STAGE_COMPROU : STAGE_ENTRADA;
    const valueText = amount ? `R$ ${Number(amount).toLocaleString("pt-BR", {
      minimumFractionDigits: 2
    })}` : "";
    const methodText = method === "credit_card" ? `cartão${installments > 1 ? ` ${installments}x` : ""}` : "pix";
    const noteLine = isPaid ? `[${new Date().toLocaleDateString("pt-BR")}] Comprou ingresso Mansão Empreendedora via site — ${valueText} (${methodText}). Pedido ${orderId || ""}` : `[${new Date().toLocaleDateString("pt-BR")}] Iniciou checkout no site (pedido pendente ${orderId || ""})`;
    if (lead) {
      const updates = {
        notes: lead.notes ? `${lead.notes}\n${noteLine}` : noteLine,
        last_activity_at: new Date().toISOString()
      };
      // Só muda etapa quando pagar (pendente não rebaixa lead que já avançou no funil)
      if (isPaid && lead.stage_id !== STAGE_COMPROU) {
        updates.stage_id = STAGE_COMPROU;
        updates.stage_entered_at = new Date().toISOString();
        if (amount) updates.opportunity_value = Number(amount);
      }
      // lead que já existia sem origem ganha o tracking agora (não sobrescreve o que já tem)
      if (temTracking && !lead.utm_source && !lead.fbclid && !lead.meta_ad_id) Object.assign(updates, trkCols);
      await supabase.from("crm_leads").update(updates).eq("id", lead.id);
    } else {
      const { error: insErr } = await supabase.from("crm_leads").insert({
        name,
        phone: digits || null,
        email: email || null,
        pipeline_id: PIPELINE_ID,
        stage_id: targetStage,
        origin: "Site Mansão (checkout)",
        opportunity_value: isPaid && amount ? Number(amount) : null,
        notes: noteLine,
        entered_pipeline_at: new Date().toISOString(),
        stage_entered_at: new Date().toISOString(),
        ...(temTracking ? trkCols : {})
      });
      if (insErr) console.error("[mansao-sale-hook] insert error:", insErr);
    }
    // Financeiro do Nexus: recebível já baixado + crédito líquido no banco certo (só em pagamento confirmado)
    let finInfo = "";
    if (isPaid && Number(amount) > 0 && orderId) {
      try {
        const gross = Math.round(Number(amount) * 100) / 100;
        const fee = Math.round(gross * PROVIDER_FEE_RATE * 100) / 100;
        const net = Math.round((gross - fee) * 100) / 100;
        const bankId = provider === "mercadopago" ? BANK_MERCADOPAGO : BANK_ASAAS;
        const bankName = provider === "mercadopago" ? "Mercado Pago" : "Asaas";
        const refKey = `mansao:${orderId}`;
        const today = new Date().toISOString().slice(0, 10);
        const eventLabel = EVENT_LABEL[eventKey] || "Mansão Empreendedora";
        const description = `Mansão Empreendedora ${eventLabel} — ingresso — ${name}`;
        // idempotência: webhook pode disparar mais de uma vez
        const { data: existing } = await supabase.from("financial_receivables").select("id").eq("asaas_payment_id", refKey).maybeSingle();
        if (existing) {
          finInfo = "Financeiro: recebível já existia";
        } else {
          const { data: rec, error: recErr } = await supabase.from("financial_receivables").insert({
            description,
            amount: gross,
            due_date: today,
            paid_date: today,
            paid_amount: net,
            fee_amount: fee,
            discount_amount: 0,
            interest_amount: 0,
            late_fee_amount: 0,
            status: "paid",
            payment_method: method === "credit_card" ? "credit_card" : "pix",
            category_id: CATEGORY_EVENTOS,
            company_id: null,
            custom_receiver_name: name,
            asaas_payment_id: refKey,
            notes: `Venda pelo site (${bankName}). Bruto R$ ${gross.toFixed(2)} · taxa ${(PROVIDER_FEE_RATE * 100).toFixed(2)}% R$ ${fee.toFixed(2)} · líquido R$ ${net.toFixed(2)}. Pedido ${orderId}`
          }).select("id").single();
          if (recErr) throw recErr;
          const netCents = Math.round(net * 100);
          await supabase.rpc("increment_bank_balance", {
            p_bank_id: bankId,
            p_amount: netCents
          });
          await supabase.from("financial_bank_transactions").insert({
            bank_id: bankId,
            type: "credit",
            amount_cents: netCents,
            description: `Recebimento: ${description} (taxa ${bankName} 1,99%: R$ ${fee.toFixed(2)})`,
            reference_type: "receivable",
            reference_id: rec.id,
            fee_cents: Math.round(fee * 100),
            discount_cents: 0,
            interest_cents: 0
          });
          finInfo = `Financeiro: R$ ${net.toFixed(2)} liquido no ${bankName} (taxa R$ ${fee.toFixed(2)})`;
        }
      } catch (e) {
        console.error("[mansao-sale-hook] financeiro:", e);
        finInfo = "Financeiro: ERRO ao lancar (ver logs)";
      }
    }
    // Notificação WhatsApp pro Fabrício (só em pagamento confirmado)
    if (isPaid) {
      try {
        const { data: inst } = await supabase.from("whatsapp_instances").select("api_url, api_key, instance_name").eq("instance_name", NOTIFY_INSTANCE).maybeSingle();
        if (inst?.api_url && inst?.api_key) {
          const msg = `VENDA CONFIRMADA - Mansao Empreendedora\n\nNome: ${name}\nWhatsApp: ${digits || "nao informado"}\nValor: ${valueText}\nPagamento: ${methodText}\n\nLead movido para "Comprou evento" no CRM.${finInfo ? "\n" + finInfo : ""}`;
          await fetch(`${inst.api_url}/message/sendText/${inst.instance_name}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: inst.api_key
            },
            body: JSON.stringify({
              number: NOTIFY_PHONE,
              text: msg
            })
          });
        } else {
          console.warn("[mansao-sale-hook] instancia fabricionunnes indisponivel");
        }
      } catch (e) {
        console.error("[mansao-sale-hook] erro no envio WhatsApp:", e);
      }
    }
    return new Response(JSON.stringify({
      success: true
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (e) {
    console.error("[mansao-sale-hook] error:", e);
    return new Response(JSON.stringify({
      error: String(e)
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});