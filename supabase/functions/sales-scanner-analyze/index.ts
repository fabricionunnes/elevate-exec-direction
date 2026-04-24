import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: object, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const formatBRPhone = (raw: string) => {
  if (!raw) return raw;
  const digits = String(raw).replace(/\D/g, "");
  let hasDDI = false;
  let clean = digits;
  if (digits.startsWith("55") && digits.length >= 12) {
    hasDDI = true;
    clean = digits.slice(2);
  }
  let formatted = raw;
  if (clean.length === 11) formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  else if (clean.length === 10) formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return hasDDI ? `+55 ${formatted}` : formatted;
};

const normalizeBRPhone = (p: string) => {
  let clean = (p || "").replace(/\D/g, "");
  if (clean.length === 10 || clean.length === 11) clean = "55" + clean;
  if (clean.length === 12 && clean.startsWith("55")) clean = clean.slice(0, 4) + "9" + clean.slice(4);
  return clean;
};

async function getPipelineAndStages(supabase: any) {
  const { data: pipeline } = await supabase
    .from("crm_pipelines")
    .select("id, name")
    .eq("name", "Isca de baleia")
    .maybeSingle();
  if (!pipeline) return { pipeline: null, stages: {} as Record<string, string> };

  const { data: stages } = await supabase
    .from("crm_stages")
    .select("id, name")
    .eq("pipeline_id", pipeline.id);

  const map: Record<string, string> = {};
  for (const s of stages || []) map[s.name] = s.id;
  return { pipeline, stages: map };
}

async function sendWhatsAppToTeam(supabase: any, message: string) {
  const { data: instanceSetting } = await supabase
    .from("crm_settings")
    .select("setting_value")
    .eq("setting_key", "lead_notification_instance_name")
    .maybeSingle();
  const instanceName = (instanceSetting?.setting_value as string) || "fabricionunnes";

  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("instance_name, api_url, api_key")
    .eq("instance_name", instanceName)
    .maybeSingle();
  if (!instance?.api_url || !instance?.api_key) return;

  const { data: staffNumbers } = await supabase
    .from("onboarding_staff")
    .select("phone")
    .eq("is_active", true)
    .in("role", ["master", "head_comercial", "sdr"])
    .not("phone", "is", null);

  const numbers: string[] = [];
  for (const s of staffNumbers || []) {
    const n = normalizeBRPhone(s.phone || "");
    if (n && !numbers.includes(n)) numbers.push(n);
  }

  const { data: notifNumbers } = await supabase
    .from("crm_lead_notification_numbers")
    .select("phone")
    .eq("is_active", true);
  for (const n of notifNumbers || []) {
    const c = normalizeBRPhone(n.phone || "");
    if (c && !numbers.includes(c)) numbers.push(c);
  }

  for (const phone of numbers) {
    try {
      await fetch(`${instance.api_url}/message/sendText/${instance.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: instance.api_key },
        body: JSON.stringify({ number: phone, text: message }),
      });
    } catch (e) {
      console.error("[sales-scanner] WA send error", phone, e);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const { action } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── 1) Cria submissão + lead inicial ───
    if (action === "create_initial") {
      const { full_name, whatsapp, email } = body;
      if (!full_name || !whatsapp || !email) return json({ error: "Campos obrigatórios" }, 400);

      const cleanPhone = whatsapp.replace(/\D/g, "");

      const { pipeline, stages } = await getPipelineAndStages(supabase);
      if (!pipeline) return json({ error: "Pipeline Isca de baleia não encontrado" }, 500);

      // Verifica lead existente nesse pipeline (24h)
      const dedup = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existingLead } = await supabase
        .from("crm_leads")
        .select("id")
        .eq("pipeline_id", pipeline.id)
        .gte("created_at", dedup)
        .or(`email.eq.${email},phone.eq.${cleanPhone}`)
        .limit(1)
        .maybeSingle();

      const { data: owner } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("is_active", true)
        .in("role", ["master", "admin"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      let leadId = existingLead?.id;
      if (!leadId) {
        const { data: newLead, error: leadErr } = await supabase
          .from("crm_leads")
          .insert({
            name: full_name,
            phone: cleanPhone,
            email,
            pipeline_id: pipeline.id,
            stage_id: stages["Dados iniciais"],
            owner_staff_id: owner?.id || null,
            urgency: "medium",
            entered_pipeline_at: new Date().toISOString(),
            notes: "Origem: Scanner de Vendas UNV",
          })
          .select("id")
          .single();
        if (leadErr) {
          console.error("[sales-scanner] lead insert error", leadErr);
          return json({ error: "Erro ao criar lead" }, 500);
        }
        leadId = newLead.id;
      }

      const { data: submission, error: subErr } = await supabase
        .from("sales_scanner_submissions")
        .insert({
          full_name,
          whatsapp: cleanPhone,
          email,
          lead_id: leadId,
          funnel_status: "initial",
        })
        .select("id")
        .single();
      if (subErr) {
        console.error("[sales-scanner] submission insert error", subErr);
        return json({ error: "Erro ao criar submissão" }, 500);
      }

      // Notificação WhatsApp da equipe
      const APP_URL = "https://elevate-exec-direction.lovable.app";
      const msg =
        `🎯 *Scanner de Vendas — Novo lead!*\n\n` +
        `👤 *Nome:* ${full_name}\n` +
        `📞 *WhatsApp:* ${formatBRPhone(cleanPhone)}\n` +
        `📧 *Email:* ${email}\n\n` +
        `🔗 ${APP_URL}/#/crm/leads/${leadId}`;
      await sendWhatsAppToTeam(supabase, msg);

      // Automação
      try {
        await supabase.functions.invoke("automation-engine", {
          body: {
            trigger_type: "lead_created",
            trigger_data: {
              lead_id: leadId,
              lead_name: full_name,
              lead_phone: cleanPhone,
              pipeline_id: pipeline.id,
              pipeline_name: pipeline.name,
            },
          },
        });
      } catch (e) {
        console.error("[sales-scanner] automation error", e);
      }

      return json({ success: true, submission_id: submission.id, lead_id: leadId });
    }

    // ─── 2) Salva progresso parcial (autosave) ───
    if (action === "save_progress") {
      const { submission_id, data } = body;
      if (!submission_id) return json({ error: "submission_id obrigatório" }, 400);

      const { error } = await supabase
        .from("sales_scanner_submissions")
        .update(data || {})
        .eq("id", submission_id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ─── 3) Finaliza + IA ───
    if (action === "finalize_and_analyze") {
      const { submission_id } = body;
      if (!submission_id) return json({ error: "submission_id obrigatório" }, 400);

      const { data: sub, error: subErr } = await supabase
        .from("sales_scanner_submissions")
        .select("*")
        .eq("id", submission_id)
        .single();
      if (subErr || !sub) return json({ error: "Submissão não encontrada" }, 404);

      // === Cálculo de perda financeira (servidor é fonte de verdade) ===
      const leads = Number(sub.leads_per_month) || 0;
      const conv = Number(sub.conversion_rate) || 0; // %
      const ticket = Number(sub.avg_ticket) || 0;

      const currentRevenue = leads * (conv / 100) * ticket;
      const newConv = conv * 1.1;
      const newTicket = ticket * 1.1;
      const potentialRevenue = leads * (newConv / 100) * newTicket;
      const monthlyLoss = Math.max(0, potentialRevenue - currentRevenue);
      const annualLoss = monthlyLoss * 12;

      // === IA via Lovable AI Gateway ===
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      let diagnosis = {
        diagnosis_text: "",
        performance_level: "medio",
        bottlenecks: [] as string[],
        action_plan: [] as Array<{ title: string; description: string }>,
      };

      if (LOVABLE_API_KEY) {
        const userPayload = {
          empresa: sub.company_name,
          segmento: sub.segment,
          faturamento_faixa: sub.revenue_range,
          vendedores: sub.sellers_count,
          gerente_comercial: sub.has_sales_manager,
          canais_leads: sub.lead_channels,
          leads_mes: sub.leads_per_month,
          processo_definido: sub.has_process,
          ticket_medio: sub.avg_ticket,
          conversao_pct: sub.conversion_rate,
          ciclo_dias: sub.sales_cycle_days,
          vendas_mes: sub.sales_per_month,
          tem_crm: sub.has_crm,
          acompanha_metas: sub.tracks_goals_daily,
          investe_trafego: sub.invests_paid_traffic,
          investimento_mensal: sub.paid_traffic_monthly,
          custo_por_lead: sub.cost_per_lead,
          equipe_marketing: sub.has_marketing_team,
          maturidade: {
            organizacao: sub.maturity_organization,
            metas: sub.maturity_goals,
            previsibilidade: sub.maturity_predictability,
            qualidade_leads: sub.maturity_lead_quality,
            performance: sub.maturity_performance,
          },
          calculo: { currentRevenue, potentialRevenue, monthlyLoss, annualLoss },
        };

        try {
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content:
                    "Você é um Diretor Comercial Sênior da UNV. Analise os dados de uma empresa e produza um diagnóstico comercial direto, em português do Brasil, com foco em onde a empresa perde dinheiro e como resolver. Use linguagem clara, executiva, sem clichês.",
                },
                {
                  role: "user",
                  content: `Analise estes dados e devolva o diagnóstico via tool call:\n${JSON.stringify(userPayload, null, 2)}`,
                },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "report_diagnosis",
                    description: "Retorna o diagnóstico comercial estruturado",
                    parameters: {
                      type: "object",
                      properties: {
                        diagnosis_text: {
                          type: "string",
                          description: "Diagnóstico em 2-3 parágrafos curtos, direto ao ponto, em pt-BR",
                        },
                        performance_level: {
                          type: "string",
                          enum: ["baixo", "medio", "alto"],
                        },
                        bottlenecks: {
                          type: "array",
                          items: {
                            type: "string",
                            enum: [
                              "Conversão baixa",
                              "Ticket baixo",
                              "Falta de gestão",
                              "Falta de processo",
                              "Problema de leads",
                              "Falta de liderança",
                            ],
                          },
                        },
                        action_plan: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              title: { type: "string" },
                              description: { type: "string" },
                            },
                            required: ["title", "description"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["diagnosis_text", "performance_level", "bottlenecks", "action_plan"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "report_diagnosis" } },
            }),
          });

          if (aiResp.status === 429) console.warn("[sales-scanner] AI rate limited");
          else if (aiResp.status === 402) console.warn("[sales-scanner] AI payment required");

          const aiData = await aiResp.json();
          const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            try {
              const parsed = JSON.parse(toolCall.function.arguments);
              diagnosis = { ...diagnosis, ...parsed };
            } catch (e) {
              console.error("[sales-scanner] parse tool_call", e);
            }
          }
        } catch (e) {
          console.error("[sales-scanner] AI error", e);
        }
      }

      // Fallback se IA falhou
      if (!diagnosis.diagnosis_text) {
        const isLow = (sub.maturity_organization || 0) + (sub.maturity_goals || 0) +
          (sub.maturity_predictability || 0) + (sub.maturity_lead_quality || 0) +
          (sub.maturity_performance || 0) < 12;
        diagnosis.diagnosis_text =
          "Sua operação comercial apresenta margem clara para crescimento. Os indicadores apontam que pequenos ajustes em conversão e ticket médio podem destravar um novo patamar de faturamento sem aumentar custos.";
        diagnosis.performance_level = isLow ? "baixo" : "medio";
        diagnosis.bottlenecks = ["Falta de processo", "Conversão baixa"];
        diagnosis.action_plan = [
          { title: "Implantar processo comercial", description: "Estruturar etapas claras de prospecção, qualificação e fechamento." },
          { title: "Implementar CRM", description: "Centralizar leads e oportunidades para ganhar visibilidade do pipeline." },
          { title: "Rotina de gestão", description: "Reuniões diárias de pipeline e acompanhamento de metas." },
        ];
      }

      // Atualiza submissão
      const { pipeline, stages } = await getPipelineAndStages(supabase);
      const completedAt = new Date().toISOString();

      await supabase
        .from("sales_scanner_submissions")
        .update({
          diagnosis_text: diagnosis.diagnosis_text,
          performance_level: diagnosis.performance_level,
          bottlenecks: diagnosis.bottlenecks,
          action_plan: diagnosis.action_plan,
          current_revenue: currentRevenue,
          potential_revenue: potentialRevenue,
          monthly_loss: monthlyLoss,
          annual_loss: annualLoss,
          funnel_status: "completed",
          completed_at: completedAt,
        })
        .eq("id", submission_id);

      // Move lead para "Preencheu formulário"
      if (sub.lead_id && stages["Preencheu formulário"]) {
        await supabase
          .from("crm_leads")
          .update({
            stage_id: stages["Preencheu formulário"],
            company: sub.company_name || undefined,
          })
          .eq("id", sub.lead_id);
      }

      return json({
        success: true,
        diagnosis,
        revenue: { currentRevenue, potentialRevenue, monthlyLoss, annualLoss },
      });
    }

    // ─── 4) Solicitou reunião ───
    if (action === "request_meeting") {
      const { submission_id } = body;
      if (!submission_id) return json({ error: "submission_id obrigatório" }, 400);

      const { data: sub } = await supabase
        .from("sales_scanner_submissions")
        .select("*")
        .eq("id", submission_id)
        .single();
      if (!sub) return json({ error: "Submissão não encontrada" }, 404);

      const { pipeline, stages } = await getPipelineAndStages(supabase);
      const meetingAt = new Date().toISOString();

      await supabase
        .from("sales_scanner_submissions")
        .update({ funnel_status: "requested_meeting", meeting_requested_at: meetingAt })
        .eq("id", submission_id);

      if (sub.lead_id && stages["Solicitou reunião"]) {
        await supabase
          .from("crm_leads")
          .update({ stage_id: stages["Solicitou reunião"], urgency: "high" })
          .eq("id", sub.lead_id);
      }

      // Notificação prioritária
      const APP_URL = "https://elevate-exec-direction.lovable.app";
      const msg =
        `🚨 *Scanner de Vendas — SOLICITOU REUNIÃO!*\n\n` +
        `👤 *Nome:* ${sub.full_name}\n` +
        `📞 *WhatsApp:* ${formatBRPhone(sub.whatsapp)}\n` +
        `📧 *Email:* ${sub.email}\n` +
        (sub.company_name ? `🏢 *Empresa:* ${sub.company_name}\n` : "") +
        (sub.monthly_loss ? `💸 *Perda mensal estimada:* R$ ${Number(sub.monthly_loss).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}\n` : "") +
        `\n🔗 ${APP_URL}/#/crm/leads/${sub.lead_id}`;
      await sendWhatsAppToTeam(supabase, msg);

      return json({ success: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e: unknown) {
    console.error("[sales-scanner] fatal", e);
    return json({ error: String(e) }, 500);
  }
});
