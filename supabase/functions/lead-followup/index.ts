// ============================================================
// lead-followup (Nexus / CRM Comercial)
// Gera opções de follow-up personalizado de WhatsApp pro lead (aba
// "Follow up personalizado" do CRM). Cada opção:
//   - cita uma NOTÍCIA/TENDÊNCIA REAL e recente do mercado (busca web),
//     voltada a gestão comercial / vendas / crescimento de PME no Brasil;
//   - amarra a novidade ao que a UNV faz e ao contexto real do lead
//     (segmento, dor, instagram, reuniões já feitas, qualificação);
//   - dá CONTINUIDADE ao último follow-up já ENVIADO (crm_lead_followups)
//     — sem repetir notícia/ângulo/abertura, evoluindo a régua.
//
// Front chama: supabase.functions.invoke("lead-followup", { body: { leadId, count } })
// Retorna: { options:[{angle,message,news_headline,news_url,news_source}], history_count, lead:{name,phone} }
//
// Deploy: fora do CI — Management API (igual às demais functions ad-hoc do Nexus).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Sonnet 5 suporta web_search_20260209 (filtragem dinâmica). Configurável.
const AI_MODEL = Deno.env.get("AI_FOLLOWUP_MODEL") || "claude-sonnet-5";
const WEB_SEARCH_TOOL = Deno.env.get("AI_WEB_SEARCH_TOOL") || "web_search_20260209";

function extractJson(text: string): any {
  let t = (text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

function systemPrompt(count: number): string {
  return `Você é Fabrício Nunes, CEO e fundador da UNV (Universidade Nacional de Vendas).
A UNV é diretor comercial terceirizado para pequenas e médias empresas: estrutura o time comercial, cria processo e gestão, e faz a empresa bater meta todo mês (ticket médio, conversão, CAC, LTV, previsibilidade).

Sua tarefa: gerar ${count} OPÇÕES DIFERENTES de mensagem de follow-up de WhatsApp para o lead, a partir do contexto real dele.

REGRAS DE CADA MENSAGEM:
1. Ancore em uma NOTÍCIA ou TENDÊNCIA REAL e RECENTE (use a busca na web) ligada a vendas, gestão comercial, crescimento de PME, IA aplicada a vendas, ou economia que afeta PME no Brasil. Nada de notícia inventada — use o que a busca retornar. Não precisa colar o link no texto da mensagem; use a novidade como gancho natural.
2. AMARRE a novidade ao que a UNV faz e ao contexto do lead (segmento, dor, instagram/nicho, reuniões já feitas, qualificação). Personalize com o primeiro nome.
3. CONTINUIDADE: se houver follow-ups já enviados (na seção HISTÓRICO), a mensagem tem que dar sequência ao ÚLTIMO enviado — sem repetir a mesma notícia, o mesmo ângulo nem a mesma abertura. Evolua a relação (1º toque leve → aprofunda → traz caso/tendência → chama pra conversa).
4. Tom do Fabrício: direto, humano, sem parecer robô, SEM emojis, uma intenção por mensagem, tamanho de WhatsApp (2 a 5 linhas curtas). CTA suave (uma pergunta ou convite, nunca pressão).
5. As ${count} opções devem ter ângulos/notícias DISTINTOS entre si.

Responda SOMENTE com um objeto JSON válido, sem comentários, neste formato exato:
{
  "options": [
    {
      "angle": "string curta — o ângulo/tema desta opção",
      "message": "string — a mensagem de WhatsApp pronta pra enviar (com quebras de linha reais)",
      "news_headline": "string — a manchete/tendência real usada como gancho",
      "news_url": "string — link da fonte (ou vazio se não houver)",
      "news_source": "string — nome da fonte (ou vazio)"
    }
  ]
}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const leadId: string = (body.leadId || "").toString();
    let count = Number(body.count || 4);
    if (!Number.isFinite(count) || count < 2) count = 4;
    if (count > 6) count = 6;

    if (!leadId) return json({ error: "leadId_required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Lead
    const { data: lead, error: leadErr } = await admin
      .from("crm_leads").select("*").eq("id", leadId).maybeSingle();
    if (leadErr) return json({ error: "db_error", detail: leadErr.message }, 500);
    if (!lead) return json({ error: "lead_not_found" }, 404);

    // 2) Contexto em paralelo: etapa, dono, reuniões, tags, follow-ups enviados
    const [stageRes, ownerRes, meetingEventsRes, tagsRes, historyRes] = await Promise.all([
      lead.stage_id
        ? admin.from("crm_stages").select("name").eq("id", lead.stage_id).maybeSingle()
        : Promise.resolve({ data: null }),
      lead.owner_staff_id
        ? admin.from("onboarding_staff").select("name").eq("id", lead.owner_staff_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("crm_meeting_events")
        .select("event_type, event_date").eq("lead_id", leadId)
        .order("event_date", { ascending: false }).limit(20),
      admin.from("crm_lead_tags").select("crm_tags(name)").eq("lead_id", leadId),
      admin.from("crm_lead_followups")
        .select("message, angle, news_headline, sent_at")
        .eq("lead_id", leadId).order("sent_at", { ascending: true }).limit(20),
    ]);

    const currentStage: any = stageRes.data;
    const owner: any = ownerRes.data;
    const meetingEvents: any[] = meetingEventsRes.data || [];
    const tags = (tagsRes.data || []).map((r: any) => r.crm_tags?.name).filter(Boolean);
    const history: any[] = historyRes.data || [];
    const realized = meetingEvents.filter(e => e.event_type === "realized").length;

    // 3) IA configurada?
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "ia_nao_configurada",
        detail: "ANTHROPIC_API_KEY não configurada no projeto." }, 200);
    }

    // 4) Contexto textual
    const ctx: string[] = [];
    ctx.push("=== LEAD ===");
    ctx.push(`Nome/Responsável: ${lead.name}`);
    if (lead.company) ctx.push(`Empresa: ${lead.company}`);
    if (lead.trade_name) ctx.push(`Nome fantasia: ${lead.trade_name}`);
    if (lead.instagram) ctx.push(`Instagram: ${lead.instagram}`);
    if (lead.role) ctx.push(`Cargo do contato: ${lead.role}`);
    if (lead.segment) ctx.push(`Segmento/nicho: ${lead.segment}`);
    if (lead.city || lead.state) ctx.push(`Localização: ${[lead.city, lead.state].filter(Boolean).join("/")}`);
    if (lead.employee_count) ctx.push(`Porte (funcionários): ${lead.employee_count}`);
    if (lead.estimated_revenue) ctx.push(`Faturamento estimado: ${lead.estimated_revenue}`);
    if (lead.main_pain) ctx.push(`Principal dor: ${lead.main_pain}`);
    if (lead.urgency) ctx.push(`Urgência: ${lead.urgency}`);
    if (lead.has_partner != null) ctx.push(`Tem sócio: ${lead.has_partner ? "sim" : "não"}`);
    if (lead.notes) ctx.push(`Notas: ${lead.notes}`);
    ctx.push(`Etapa atual: ${currentStage?.name ?? "—"} | Responsável UNV: ${owner?.name ?? "—"}`);
    ctx.push(`Reuniões já realizadas com este lead: ${realized}`);
    if (tags.length) ctx.push(`Tags: ${tags.join(", ")}`);

    ctx.push("\n=== HISTÓRICO DE FOLLOW-UPS JÁ ENVIADOS (do mais antigo ao mais recente) ===");
    if (history.length) {
      history.forEach((h, i) => {
        ctx.push(`#${i + 1} [${(h.sent_at || "").toString().slice(0, 10)}] ângulo: ${h.angle || "—"}${h.news_headline ? ` | gancho: ${h.news_headline}` : ""}`);
        ctx.push(`   texto: ${(h.message || "").toString().slice(0, 400)}`);
      });
      ctx.push("\nATENÇÃO: dê continuidade ao ÚLTIMO enviado acima. NÃO repita a notícia, o ângulo nem a abertura já usados. Traga uma novidade diferente e avance a relação.");
    } else {
      ctx.push("(nenhum ainda — este é o primeiro follow-up; abertura leve, sem parecer cobrança)");
    }
    ctx.push(`\nGere ${count} opções agora.`);

    // 5) Anthropic Messages API com busca web (loop pra tratar pause_turn)
    const tools = [{
      type: WEB_SEARCH_TOOL,
      name: "web_search",
      max_uses: 4,
      user_location: { type: "approximate", country: "BR" },
    }];

    const messages: any[] = [{ role: "user", content: ctx.join("\n") }];
    let aiObj: any = null;

    try {
      for (let iter = 0; iter < 4; iter++) {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: AI_MODEL,
            max_tokens: 4000,
            system: systemPrompt(count),
            tools,
            messages,
          }),
        });

        const rawText = await resp.text();
        if (!resp.ok) {
          return json({ error: "ia_request_failed",
            detail: `Anthropic respondeu ${resp.status}: ${rawText.slice(0, 500)}` }, 200);
        }
        const data = JSON.parse(rawText);

        if (data.stop_reason === "pause_turn") {
          messages.push({ role: "assistant", content: data.content });
          continue;
        }

        const textOut = (data.content || [])
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text).join("\n").trim();
        try {
          aiObj = extractJson(textOut);
        } catch (_e) {
          return json({ error: "ia_parse_failed",
            detail: "A IA não devolveu um JSON válido.", raw: textOut.slice(0, 800) }, 200);
        }
        break;
      }
    } catch (e: any) {
      return json({ error: "ia_request_failed", detail: e?.message || "Falha ao chamar a IA." }, 200);
    }

    if (!aiObj) return json({ error: "ia_request_failed", detail: "A IA não concluiu a geração." }, 200);

    const options = Array.isArray(aiObj.options) ? aiObj.options : [];

    return json({
      options,
      history_count: history.length,
      lead: { name: lead.name, phone: lead.phone ?? null },
    }, 200);
  } catch (e: any) {
    return json({ error: "internal_error", detail: e?.message || String(e) }, 500);
  }
});
