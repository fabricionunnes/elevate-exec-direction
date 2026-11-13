// Edge function: notify when public Contract Data form is submitted
// No sistema (onboarding_notifications): dono do lead + masters + head_comercial ativos.
// No WhatsApp: só o closer responsável pelo lead, pela conexão Fabrício Nunnes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  leadId: string;
  dry_run?: boolean; // simula: não grava notificação nem envia WhatsApp
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, dry_run } = (await req.json()) as Payload;
    const dryRun = dry_run === true;
    if (!leadId) {
      return new Response(JSON.stringify({ error: "leadId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1) Fetch lead
    const { data: lead, error: leadErr } = await supabase
      .from("crm_leads")
      .select("id, name, company, owner_staff_id")
      .eq("id", leadId)
      .maybeSingle();

    if (leadErr || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found", details: leadErr?.message }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2) Build recipient list: owner + masters + head_comercial
    const recipientIds = new Set<string>();
    if (lead.owner_staff_id) recipientIds.add(lead.owner_staff_id);

    const { data: leaders } = await supabase
      .from("onboarding_staff")
      .select("id")
      .eq("is_active", true)
      .in("role", ["master", "head_comercial"]);

    (leaders || []).forEach((s: { id: string }) => recipientIds.add(s.id));

    if (recipientIds.size === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No recipients" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ids = Array.from(recipientIds);

    // 3) Fetch staff details (name + phone)
    const { data: staffList } = await supabase
      .from("onboarding_staff")
      .select("id, name, phone")
      .in("id", ids);

    const leadLabel = lead.company
      ? `${lead.name} (${lead.company})`
      : lead.name;

    const title = "📄 Dados Contratuais Preenchidos";
    const message = `O lead ${leadLabel} preencheu o formulário de dados contratuais.`;

    // 4) Insert in-system notifications
    const notificationRows = ids.map((staffId) => ({
      staff_id: staffId,
      type: "contract",
      title,
      message,
      reference_id: lead.id,
      reference_type: "crm_lead",
      is_read: false,
    }));

    if (!dryRun) {
      const { error: notifErr } = await supabase
        .from("onboarding_notifications")
        .insert(notificationRows);

      if (notifErr) {
        console.error("Error inserting notifications:", notifErr);
      }
    }

    // 5) WhatsApp pro closer responsável pelo lead, pela conexão Fabrício Nunnes (pedido do
    // Fabrício em 13/11/2026). O envio vai direto na conexão: a função evolution-api só aceita
    // usuário logado e recusava a chamada daqui (401), por isso o aviso nunca saía.
    const INSTANCIA_AVISO = "fabricionunnes";
    const leadUrl = `https://unvholdings.com.br/#/crm/leads/${lead.id}`;
    const waMessage =
      `📄 *Dados do contrato preenchidos*\n\n` +
      `*${lead.name}*${lead.company ? ` (${lead.company})` : ""} acabou de preencher os dados do contrato.\n\n` +
      `Abrir o lead:\n${leadUrl}`;

    const dono = (staffList || []).find((s: { id: string }) => s.id === lead.owner_staff_id) || null;
    let fone = String(dono?.phone || "").replace(/\D/g, "");
    if (fone && !fone.startsWith("55") && (fone.length === 10 || fone.length === 11)) fone = "55" + fone;

    const whatsapp = { para: dono?.name || null, instancia: INSTANCIA_AVISO, enviado: false, motivo: "" };
    const { data: inst } = await supabase
      .from("whatsapp_instances")
      .select("instance_name, api_url, api_key, provider_type, phone_number, status")
      .eq("instance_name", INSTANCIA_AVISO)
      .maybeSingle();

    if (!dono) whatsapp.motivo = "lead sem responsável";
    else if (!fone) whatsapp.motivo = "responsável sem telefone no cadastro";
    else if (!inst || inst.status !== "connected") whatsapp.motivo = "conexão desconectada";
    else if (!inst.api_url || !inst.api_key) whatsapp.motivo = "conexão sem credenciais";
    else if (String(inst.phone_number || "").replace(/\D/g, "") === fone) whatsapp.motivo = "o responsável é o próprio número da conexão";
    else if (dryRun) whatsapp.motivo = "simulação: nada enviado";
    else {
      try {
        const base = String(inst.api_url).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
        const v2 = inst.provider_type === "manager_v2" || base.includes("stevo");
        const url = v2 ? `${base}/send/text` : `${base}/message/sendText/${inst.instance_name}`;
        const r = await fetch(url, {
          method: "POST",
          headers: { apikey: String(inst.api_key), "Content-Type": "application/json" },
          body: JSON.stringify({ number: fone, text: waMessage }),
        });
        whatsapp.enviado = r.ok;
        if (!r.ok) whatsapp.motivo = `falha no envio (${r.status})`;
      } catch (err) {
        whatsapp.motivo = `falha no envio (${(err as Error).message})`;
      }
    }
    if (!whatsapp.enviado && !dryRun) console.warn("WhatsApp dos dados contratuais não enviado:", whatsapp.motivo);

    return new Response(
      JSON.stringify({
        ok: true,
        notifiedStaff: dryRun ? 0 : ids.length,
        dry: dryRun || undefined,
        whatsapp,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("notify-contract-form-submitted error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
