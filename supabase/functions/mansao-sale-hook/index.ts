// Recebe eventos de venda do site da Mansão Empreendedora (mansaoempreendedora.com.br)
// - status "pending": pedido criado no checkout sem pagamento -> lead na etapa Entrada
// - status "paid": pagamento confirmado -> lead na etapa Comprou evento + WhatsApp pro Fabrício
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const PIPELINE_ID = "d75962f6-4369-4d92-9386-52d477602149"; // MANSÃO EMPREENDEDORA
const STAGE_ENTRADA = "79e7818f-d949-4980-8a60-0595c8b22cc3";
const STAGE_COMPROU = "80c7b37d-2630-49ee-9d87-f209faa91f7a";
const NOTIFY_PHONE = "5531989840003"; // Fabrício
const NOTIFY_INSTANCE = "fabricionunnes";
const FALLBACK_TOKEN = "656a7068f01d8920fe9167279dcb14d19d7b6d09cb9bbcc7";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const expected = Deno.env.get("MANSAO_HOOK_TOKEN") || FALLBACK_TOKEN;
    if (req.headers.get("x-api-key") !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, phone, email, status, amount, method, installments, orderId } = await req.json();
    if (!name || !status) {
      return new Response(JSON.stringify({ error: "name e status obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Normaliza telefone: só dígitos, sem DDI 55
    let digits = String(phone || "").replace(/\D/g, "");
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);

    // Procura lead existente no funil da Mansão (pelos últimos 8 dígitos do fone ou email)
    let lead: { id: string; stage_id: string; notes: string | null } | null = null;
    if (digits.length >= 8) {
      const { data } = await supabase
        .from("crm_leads")
        .select("id, stage_id, notes")
        .eq("pipeline_id", PIPELINE_ID)
        .ilike("phone", `%${digits.slice(-8)}`)
        .limit(1);
      lead = data?.[0] ?? null;
    }
    if (!lead && email) {
      const { data } = await supabase
        .from("crm_leads")
        .select("id, stage_id, notes")
        .eq("pipeline_id", PIPELINE_ID)
        .ilike("email", email)
        .limit(1);
      lead = data?.[0] ?? null;
    }

    const isPaid = status === "paid";
    const targetStage = isPaid ? STAGE_COMPROU : STAGE_ENTRADA;
    const valueText = amount ? `R$ ${Number(amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "";
    const methodText = method === "credit_card" ? `cartão${installments > 1 ? ` ${installments}x` : ""}` : "pix";
    const noteLine = isPaid
      ? `[${new Date().toLocaleDateString("pt-BR")}] Comprou ingresso Mansão Empreendedora via site — ${valueText} (${methodText}). Pedido ${orderId || ""}`
      : `[${new Date().toLocaleDateString("pt-BR")}] Iniciou checkout no site (pedido pendente ${orderId || ""})`;

    if (lead) {
      const updates: Record<string, unknown> = {
        notes: lead.notes ? `${lead.notes}\n${noteLine}` : noteLine,
        last_activity_at: new Date().toISOString(),
      };
      // Só muda etapa quando pagar (pendente não rebaixa lead que já avançou no funil)
      if (isPaid && lead.stage_id !== STAGE_COMPROU) {
        updates.stage_id = STAGE_COMPROU;
        updates.stage_entered_at = new Date().toISOString();
        if (amount) updates.opportunity_value = Number(amount);
      }
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
      });
      if (insErr) console.error("[mansao-sale-hook] insert error:", insErr);
    }

    // Notificação WhatsApp pro Fabrício (só em pagamento confirmado)
    if (isPaid) {
      try {
        const { data: inst } = await supabase
          .from("whatsapp_instances")
          .select("api_url, api_key, instance_name")
          .eq("instance_name", NOTIFY_INSTANCE)
          .maybeSingle();

        if (inst?.api_url && inst?.api_key) {
          const msg = `VENDA CONFIRMADA - Mansao Empreendedora\n\nNome: ${name}\nWhatsApp: ${digits || "nao informado"}\nValor: ${valueText}\nPagamento: ${methodText}\n\nLead movido para "Comprou evento" no CRM.`;
          await fetch(`${inst.api_url}/message/sendText/${inst.instance_name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: inst.api_key },
            body: JSON.stringify({ number: NOTIFY_PHONE, text: msg }),
          });
        } else {
          console.warn("[mansao-sale-hook] instancia fabricionunnes indisponivel");
        }
      } catch (e) {
        console.error("[mansao-sale-hook] erro no envio WhatsApp:", e);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[mansao-sale-hook] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
