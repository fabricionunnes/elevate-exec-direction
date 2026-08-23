// onboarding-plan-generate: monta a apresentação de onboarding do cliente a
// partir do que foi VENDIDO (briefing do negócio no CRM Comercial + serviço,
// plano e valor) e do briefing da empresa no projeto. Salva em
// project_onboarding_plans, editável na aba Onboarding do projeto.
// Entrada: { project_id, extra?: string, force?: boolean }
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Esqueleto padrão UNV — usado quando não há IA disponível (ou como base dela). */
function baseSkeleton(produto: string) {
  return [
    {
      title: "Diagnóstico",
      period: "Semanas 1 e 2",
      objective: "Entender a operação comercial por dentro e definir o ponto de partida com números.",
      deliverables: [
        "Kick-off com o time e alinhamento de expectativas",
        "Raio-X Comercial: funil, jornada, conversão e ticket médio",
        "Diagnóstico dos gargalos e do que trava a meta hoje",
      ],
      client_actions: [
        "Preencher o formulário de Kick-off",
        "Dar acesso ao CRM/planilhas e histórico de vendas",
        "Disponibilizar o time para a reunião de diagnóstico",
      ],
      outcome: "Clareza do cenário atual e da meta possível, com números na mesa.",
    },
    {
      title: "Estruturação",
      period: "Semanas 3 e 4",
      objective: "Montar o processo comercial que hoje não existe ou não é seguido.",
      deliverables: [
        "Desenho do funil e das etapas com critério de passagem",
        "Playbook comercial: abordagem, qualificação, proposta e fechamento",
        "Metas por vendedor e painel de indicadores no Nexus",
      ],
      client_actions: [
        "Validar o processo desenhado",
        "Garantir que o time registre as vendas no sistema",
      ],
      outcome: "Processo escrito, metas definidas e indicadores rodando.",
    },
    {
      title: "Ativação",
      period: "Mês 2",
      objective: "Colocar o time pra operar dentro do processo, com rotina de gestão.",
      deliverables: [
        "Treinamento do time no playbook",
        "Rotina de gestão: reunião semanal com números",
        "Acompanhamento individual dos vendedores",
      ],
      client_actions: [
        "Sustentar a rotina semanal",
        "Cobrar o preenchimento dos indicadores",
      ],
      outcome: "Time operando com processo e a primeira vitória rápida no placar.",
    },
    {
      title: "Aceleração",
      period: "Meses 3 e 4",
      objective: "Subir conversão e ticket médio em cima do que já está rodando.",
      deliverables: [
        "Ajuste fino de abordagem e quebra de objeções",
        "Ações de reativação de base e aumento de ticket",
        "Análise de resultados e correção de rota",
      ],
      client_actions: ["Aprovar as ações comerciais propostas", "Manter o time na rotina"],
      outcome: "Crescimento com previsibilidade, não por esforço isolado.",
    },
    {
      title: "Escala",
      period: "Meses 5 e 6",
      objective: "Tornar o resultado previsível e menos dependente do dono.",
      deliverables: [
        "Plano de expansão do time comercial",
        "Indicadores de previsibilidade e forecast",
        "Rotina de gestão rodando sem depender da UNV no dia a dia",
      ],
      client_actions: ["Decidir sobre expansão de time/investimento"],
      outcome: `Operação comercial rodando com processo próprio${produto ? ` sustentada pelo ${produto}` : ""}.`,
    },
  ];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { project_id, extra, force } = await req.json();
    if (!project_id) return json({ error: "project_id obrigatório" }, 400);

    // já existe plano? só regera com force
    const { data: existing } = await supabase.from("project_onboarding_plans")
      .select("id, phases").eq("project_id", project_id).maybeSingle();
    if (existing && Array.isArray(existing.phases) && existing.phases.length && !force) {
      return json({ ok: true, skip: "plano já existe (use force para regerar)", plan_id: existing.id });
    }

    // 1) projeto + empresa
    const { data: proj } = await supabase.from("onboarding_projects")
      .select("id, product_name, crm_lead_id, contract_start_date, contract_value, onboarding_company_id")
      .eq("id", project_id).maybeSingle();
    if (!proj) return json({ error: "projeto não encontrado" }, 404);

    const { data: comp } = await supabase.from("onboarding_companies")
      .select("name, cnpj, segment, company_description, main_challenges, goals_short_term, goals_long_term, target_audience, commercial_structure, sales_team_size, average_ticket, conversion_rate, has_structured_process, crm_usage, objectives_with_unv, growth_target, kickoff_date, owner_name")
      .eq("id", proj.onboarding_company_id).maybeSingle();

    // 2) negócio no CRM: pelo vínculo direto ou casando o nome da empresa
    let lead: any = null;
    if (proj.crm_lead_id) {
      const { data } = await supabase.from("crm_leads")
        .select("id, company, notes, opportunity_value, installments, payment_method, product_id, plan_id, closed_at, document")
        .eq("id", proj.crm_lead_id).maybeSingle();
      lead = data;
    }
    if (!lead && comp?.name) {
      const { data: cands } = await supabase.from("crm_leads")
        .select("id, company, notes, opportunity_value, installments, payment_method, product_id, plan_id, closed_at, document")
        .not("closed_at", "is", null).order("closed_at", { ascending: false }).limit(400);
      const alvo = norm(comp.name);
      const doc = (comp.cnpj || "").replace(/\D/g, "");
      lead = (cands || []).find((c: any) => doc && (c.document || "").replace(/\D/g, "") === doc)
        || (cands || []).find((c: any) => c.company && norm(c.company) === alvo)
        || (cands || []).find((c: any) => c.company && alvo.length > 5 && (norm(c.company).includes(alvo) || alvo.includes(norm(c.company))))
        || null;
    }

    // 3) briefing: notes do negócio + campo customizado "briefing"
    let briefing: string = lead?.notes || "";
    if (lead?.id) {
      const { data: bf } = await supabase.from("crm_custom_fields")
        .select("id").ilike("field_name", "%brief%").eq("context", "deal").maybeSingle();
      if (bf?.id) {
        const { data: bv } = await supabase.from("crm_custom_field_values")
          .select("value").eq("lead_id", lead.id).eq("field_id", bf.id).maybeSingle();
        if (bv?.value && String(bv.value).length > briefing.length) briefing = String(bv.value);
      }
    }

    // 4) serviço/plano vendidos
    let produto = proj.product_name || "";
    if (lead?.product_id) {
      const { data: sv } = await supabase.from("onboarding_services").select("name").eq("id", lead.product_id).maybeSingle();
      if (sv?.name) produto = sv.name;
    }
    let plano = "";
    if (lead?.plan_id) {
      const { data: pl } = await supabase.from("crm_plans").select("name").eq("id", lead.plan_id).maybeSingle();
      plano = pl?.name || "";
    }
    const valor = Number(lead?.opportunity_value || proj.contract_value || 0);

    const contexto = [
      `EMPRESA: ${comp?.name || "—"}${comp?.segment ? ` (${comp.segment})` : ""}`,
      comp?.owner_name ? `DONO: ${comp.owner_name}` : "",
      `SERVIÇO CONTRATADO: ${produto || "—"}${plano ? ` · plano ${plano}` : ""}${valor ? ` · R$ ${valor.toLocaleString("pt-BR")}` : ""}`,
      comp?.company_description ? `SOBRE A EMPRESA: ${comp.company_description}` : "",
      comp?.main_challenges ? `DESAFIOS: ${comp.main_challenges}` : "",
      comp?.objectives_with_unv ? `OBJETIVOS COM A UNV: ${comp.objectives_with_unv}` : "",
      comp?.goals_short_term ? `METAS CURTO PRAZO: ${comp.goals_short_term}` : "",
      comp?.goals_long_term ? `METAS LONGO PRAZO: ${comp.goals_long_term}` : "",
      comp?.commercial_structure ? `ESTRUTURA COMERCIAL: ${comp.commercial_structure}` : "",
      comp?.sales_team_size ? `TAMANHO DO TIME: ${comp.sales_team_size}` : "",
      comp?.average_ticket ? `TICKET MÉDIO: ${comp.average_ticket}` : "",
      comp?.conversion_rate ? `CONVERSÃO: ${comp.conversion_rate}` : "",
      comp?.crm_usage ? `CRM QUE USA: ${comp.crm_usage}` : "",
      briefing ? `\nBRIEFING DA VENDA (CRM Comercial):\n${briefing.slice(0, 6000)}` : "",
      extra ? `\nORIENTAÇÕES EXTRAS: ${extra}` : "",
    ].filter(Boolean).join("\n");

    const skeleton = baseSkeleton(produto);
    let plan: any = {
      title: `Plano de Onboarding · ${comp?.name || ""}`.trim(),
      subtitle: produto ? `${produto}${plano ? ` · ${plano}` : ""}` : "",
      intro: "",
      phases: skeleton,
      expectations: { unv: [], cliente: [] },
      success_metrics: [],
    };
    let usedAI = false;

    const KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (KEY) {
      const prompt = `Você é diretor comercial da UNV (Universidade Nacional de Vendas), que faz terceirização de gestão comercial para PMEs. Monte a APRESENTAÇÃO DE ONBOARDING deste cliente: o caminho que ele vai trilhar com a gente para ter sucesso.

${contexto}

Regras:
- Fale COM O CLIENTE, direto e humano, sem jargão de consultoria, sem emoji, sem "sinergia/alavancar/mindset".
- Use o que está no briefing da venda: cite os problemas REAIS dele e o que foi prometido. Nada genérico.
- 4 a 6 fases, em ordem, cada uma com prazo, objetivo, o que a UNV entrega, o que o cliente precisa fazer e o resultado esperado ao fim da fase.
- As métricas de sucesso devem ser as que a UNV acompanha (ticket médio, conversão, CAC, faturamento, previsibilidade), com meta quando o briefing der base — se não der, deixe o alvo em branco.
- Não invente número que não está no material.

Responda SÓ com JSON válido neste formato:
{"intro":"2-3 frases dizendo o que foi contratado e onde queremos chegar","phases":[{"title":"","period":"","objective":"","deliverables":[""],"client_actions":[""],"outcome":""}],"expectations":{"unv":[""],"cliente":[""]},"success_metrics":[{"label":"","target":""}]}`;

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
      });
      if (r.ok) {
        const d = await r.json();
        const txt = (d.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
        const m = txt.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            const parsed = JSON.parse(m[0]);
            if (Array.isArray(parsed.phases) && parsed.phases.length) {
              plan = { ...plan, ...parsed, title: plan.title, subtitle: plan.subtitle };
              usedAI = true;
            }
          } catch (e) { console.error("[onboarding-plan] json inválido:", e); }
        }
      } else {
        console.error("[onboarding-plan] IA falhou:", r.status, (await r.text()).slice(0, 200));
      }
    }

    const row = {
      project_id,
      title: plan.title || "Plano de Onboarding",
      subtitle: plan.subtitle || null,
      intro: plan.intro || null,
      phases: plan.phases,
      expectations: plan.expectations || { unv: [], cliente: [] },
      success_metrics: plan.success_metrics || [],
      start_date: proj.contract_start_date || comp?.kickoff_date || new Date().toISOString().slice(0, 10),
      source: { lead_id: lead?.id || null, produto, plano, valor, tem_briefing: !!briefing, ia: usedAI },
      updated_at: new Date().toISOString(),
    };
    const { data: saved, error } = await supabase.from("project_onboarding_plans")
      .upsert(row, { onConflict: "project_id" }).select("id").single();
    if (error) return json({ error: error.message }, 500);

    return json({
      ok: true, plan_id: saved.id, ia: usedAI, briefing_encontrado: !!briefing,
      lead_id: lead?.id || null, produto, fases: plan.phases.length,
      aviso: usedAI ? undefined : "Gerado a partir do modelo padrão UNV (IA indisponível) — edite à vontade.",
    });
  } catch (e) {
    console.error("[onboarding-plan-generate]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
