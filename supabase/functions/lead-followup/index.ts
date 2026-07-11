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

// Duas fases (o gateway das edge functions corta em ~150s):
//   1) Haiku + busca web BÁSICA (rápida) coleta as notícias reais;
//   2) Sonnet SEM ferramentas escreve as opções (10-15s).
// A busca com filtragem dinâmica (web_search_20260209) roda code execution
// por baixo e estourava o tempo — por isso a básica na fase 1.
const AI_MODEL = Deno.env.get("AI_FOLLOWUP_MODEL") || "claude-sonnet-5";
const NEWS_MODEL = Deno.env.get("AI_NEWS_MODEL") || "claude-haiku-4-5-20251001";
const WEB_SEARCH_TOOL = Deno.env.get("AI_WEB_SEARCH_TOOL") || "web_search_20250305";

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
1. Ancore em uma das NOTÍCIAS REAIS listadas na seção "NOTÍCIAS RECENTES" do contexto (cada opção usa uma notícia DIFERENTE). Nada de notícia inventada — só as listadas. Não precisa colar o link no texto da mensagem; use a novidade como gancho natural. Preencha news_headline/news_url/news_source com os dados da notícia usada.
2. AMARRE a novidade ao que a UNV faz e ao contexto do lead (segmento, dor, instagram/nicho, reuniões já feitas, qualificação). Personalize com o primeiro nome.
3. CONTINUIDADE: se houver follow-ups já enviados (na seção HISTÓRICO), a mensagem tem que dar sequência ao ÚLTIMO enviado — sem repetir a mesma notícia, o mesmo ângulo nem a mesma abertura. Evolua a relação (1º toque leve → aprofunda → traz caso/tendência → chama pra conversa).
4. Tom do Fabrício: direto, humano, sem parecer robô, SEM emojis, uma intenção por mensagem, tamanho de WhatsApp (2 a 5 linhas curtas).
5. VARIE o fechamento entre as opções: cerca de metade SEM CTA nenhum — só conexão, gerar valor e mostrar que você acompanha o mercado dele (compartilhar o dado, uma observação, um elogio genuíno ao setor; termina sem pergunta, sem pedir nada). A outra parte com CTA suave (uma pergunta ou convite leve, nunca pressão). Se já houve follow-up com CTA no histórico e o lead não respondeu, prefira conexão pura agora.
6. As ${count} opções devem ter ângulos/notícias DISTINTOS entre si. Marque no campo "angle" quando a opção for de conexão pura (ex.: "conexão — mercado de açaí").
7. NUNCA invente interações passadas (ligações, conversas, reuniões, promessas). Só mencione contato anterior se estiver explícito nas ATIVIDADES ou no HISTÓRICO do contexto.
8. PROIBIDO usar travessão ou hífen como conector no meio da frase ("—", "–" ou " - "). Isso denuncia texto de IA. Reescreva com vírgula, ponto final ou dois pontos, como uma pessoa digitando no WhatsApp.

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
    const [stageRes, ownerRes, meetingEventsRes, tagsRes, activitiesRes, historyRes] = await Promise.all([
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
      admin.from("crm_activities")
        .select("type, title, status, notes, created_at")
        .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(10),
      admin.from("crm_lead_followups")
        .select("message, angle, news_headline, sent_at")
        .eq("lead_id", leadId).order("sent_at", { ascending: true }).limit(20),
    ]);

    const currentStage: any = stageRes.data;
    const owner: any = ownerRes.data;
    const meetingEvents: any[] = meetingEventsRes.data || [];
    const tags = (tagsRes.data || []).map((r: any) => r.crm_tags?.name).filter(Boolean);
    const recentActivities: any[] = activitiesRes.data || [];
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

    if (recentActivities.length) {
      ctx.push("\n=== ATIVIDADES RECENTES (interações reais registradas) ===");
      for (const a of recentActivities) {
        ctx.push(`[${(a.created_at || "").toString().slice(0, 10)}] ${a.type}${a.title ? ` - ${a.title}` : ""} (${a.status})${a.notes ? ` | notas: ${String(a.notes).slice(0, 150)}` : ""}`);
      }
    }

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

    // 5) FASE 1 — coleta de notícias reais (Haiku + busca web básica, rápida)
    async function callAnthropic(payload: Record<string, unknown>): Promise<any> {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey!,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const rawText = await resp.text();
      if (!resp.ok) throw new Error(`Anthropic respondeu ${resp.status}: ${rawText.slice(0, 300)}`);
      return JSON.parse(rawText);
    }

    const usedAngles = history.map(h => h.news_headline || h.angle).filter(Boolean).slice(-6);
    // Sinais do nicho: muitos leads não têm "segment" preenchido — o nicho pode
    // estar na empresa, nome fantasia, instagram ou notas. A fase 1 DEDUZ.
    const nicheSignals = [
      lead.company ? `empresa: ${lead.company}` : null,
      lead.trade_name ? `nome fantasia: ${lead.trade_name}` : null,
      lead.segment ? `segmento cadastrado: ${lead.segment}` : null,
      lead.instagram ? `instagram: ${lead.instagram}` : null,
      lead.main_pain ? `principal dor: ${lead.main_pain}` : null,
      lead.notes ? `notas: ${String(lead.notes).slice(0, 200)}` : null,
    ].filter(Boolean).join(" | ");

    let newsList: any[] = [];
    try {
      const newsMessages: any[] = [{
        role: "user",
        content: `DADOS DO LEAD (para identificar o nicho dele): ${nicheSignals || "(sem dados de nicho)"}\n\n` +
          `PASSO 1: deduza o nicho/mercado do lead a partir dos dados acima (ex.: instagram "acai2000" → mercado de açaí/alimentação; nome da empresa também revela o setor). Se não houver nenhum sinal, considere PME em geral.\n` +
          `PASSO 2: busque na web notícias RECENTES (últimos 60 dias, Brasil):\n` +
          `- PELO MENOS 2 notícias específicas do NICHO do lead (mercado, consumo, crescimento do setor);\n` +
          `- complete com: gestão comercial/processo de vendas; IA aplicada a vendas; economia que afeta PME (juros, crédito, tributos).` +
          (usedAngles.length ? `\nNÃO repita estes temas já usados: ${usedAngles.join(" | ")}.` : "") +
          `\nFaça no máximo 3 buscas. Depois responda SOMENTE com JSON válido:\n` +
          `{"niche":"nicho deduzido","news":[{"headline":"...","url":"...","source":"...","date":"...","summary":"1 a 2 frases","topic":"nicho|geral"}]}\n` +
          `Liste de 4 a 6 notícias. Só notícias que você realmente encontrou na busca.`,
      }];
      for (let iter = 0; iter < 5; iter++) {
        const data = await callAnthropic({
          model: NEWS_MODEL,
          max_tokens: 1500,
          tools: [{
            type: WEB_SEARCH_TOOL,
            name: "web_search",
            max_uses: 3,
            user_location: { type: "approximate", country: "BR" },
          }],
          messages: newsMessages,
        });
        if (data.stop_reason === "pause_turn") {
          newsMessages.push({ role: "assistant", content: data.content });
          continue;
        }
        const textOut = (data.content || [])
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text).join("\n").trim();
        const parsed = extractJson(textOut);
        newsList = Array.isArray(parsed.news) ? parsed.news.filter((n: any) => n?.headline) : [];
        if (parsed.niche) ctx.push(`\nNicho identificado do lead: ${parsed.niche}`);
        break;
      }
    } catch (e: any) {
      return json({ error: "ia_request_failed",
        detail: `Falha ao buscar notícias: ${e?.message || e}` }, 200);
    }
    if (!newsList.length) {
      return json({ error: "ia_request_failed",
        detail: "A busca não retornou notícias utilizáveis. Tente novamente." }, 200);
    }

    ctx.push("\n=== NOTÍCIAS RECENTES (reais, da busca — use uma DIFERENTE por opção) ===");
    newsList.forEach((n, i) => {
      ctx.push(`${i + 1}. ${n.topic === "nicho" ? "[DO NICHO DO LEAD] " : ""}${n.headline} [fonte: ${n.source || "—"}${n.date ? `, ${n.date}` : ""}] ${n.url || ""}`);
      if (n.summary) ctx.push(`   resumo: ${n.summary}`);
    });
    ctx.push(`\nPRIORIDADE: as notícias marcadas [DO NICHO DO LEAD] vêm primeiro — as primeiras opções devem usá-las, falando a língua do negócio dele. As genéricas de PME completam as demais.`);
    ctx.push(`\nGere ${count} opções agora.`);

    // 6) FASE 2 — escreve as opções (Sonnet, SEM ferramentas — rápido)
    let options: any[] = [];
    try {
      const data = await callAnthropic({
        model: AI_MODEL,
        max_tokens: 2500,
        thinking: { type: "disabled" }, // latência: sem thinking a escrita é bem mais rápida
        system: systemPrompt(count),
        messages: [
          { role: "user", content: ctx.join("\n") },
        ],
      });
      const textOut = (data.content || [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text).join("\n").trim();
      const parsed = extractJson(textOut);
      options = (Array.isArray(parsed.options) ? parsed.options : []).filter((o: any) => o?.message);
      // rede de segurança: travessão/hífen conector denuncia IA — troca por vírgula
      // (preserva hífen de palavra composta, ex. "e-commerce", "pós-venda")
      const cleanDashes = (s: string) => s
        .replace(/\s*[—–]\s*/g, ", ")
        .replace(/\s+-\s+/g, ", ")
        .replace(/,\s*,/g, ",");
      options = options.map((o: any) => ({ ...o, message: cleanDashes(String(o.message)) }));
    } catch (e: any) {
      return json({ error: "ia_request_failed", detail: e?.message || "Falha ao gerar as mensagens." }, 200);
    }

    if (!options.length) {
      return json({ error: "ia_parse_failed",
        detail: "A IA não devolveu opções válidas. Tente novamente." }, 200);
    }

    return json({
      options,
      history_count: history.length,
      lead: { name: lead.name, phone: lead.phone ?? null },
    }, 200);
  } catch (e: any) {
    return json({ error: "internal_error", detail: e?.message || String(e) }, 500);
  }
});
