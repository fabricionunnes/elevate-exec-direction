import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// UNV Board — motor do produto
// Ações:
//  - generate_plan { member_id }: gera o plano anual CRESCER adaptado ao segmento via IA (fica em revisão do CS)
//  - publish_plan  { member_id }: cria o projeto Board + converte o plano aprovado em onboarding_tasks
//  - nps_cron      {}          : NPS mensal no aniversário de entrada + reconciliação de respostas

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const PUBLIC_DOMAIN = "https://unvholdings.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // Ações públicas de formulário de tarefa: o token É a credencial
    if (action === "get_task_form") return await getTaskForm(supabase, body.token);
    if (action === "submit_task_form") return await submitTaskForm(supabase, body);
    if (action === "attach_task_pdf") return await attachTaskPdf(supabase, body);

    // Autorização: staff ativo (JWT), service key ou secret do cron
    const authHeader = req.headers.get("authorization") || "";
    const apiKeyHeader = req.headers.get("apikey") || "";
    const cronSecret = Deno.env.get("BOARD_CRON_SECRET");
    let trusted = apiKeyHeader === SERVICE_ROLE_KEY || authHeader.includes(SERVICE_ROLE_KEY) ||
      (!!cronSecret && req.headers.get("x-board-cron-secret") === cronSecret);
    let authUserId: string | null = null;
    if (!trusted && authHeader.startsWith("Bearer ")) {
      const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (userData?.user) {
        authUserId = userData.user.id;
        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("id")
          .eq("user_id", userData.user.id)
          .eq("is_active", true)
          .maybeSingle();
        trusted = !!staff;
      }
    }

    // generate_deliverable também pode ser chamada pelo cliente (usuário do projeto Board dele)
    if (action === "generate_deliverable" && !trusted && authUserId) {
      const { data: member } = await supabase
        .from("unv_board_members").select("project_id").eq("id", body.member_id).maybeSingle();
      if (member?.project_id) {
        const { data: pu } = await supabase
          .from("onboarding_users")
          .select("id")
          .eq("user_id", authUserId)
          .eq("project_id", member.project_id)
          .maybeSingle();
        trusted = !!pu;
      }
    }

    if (!trusted) {
      return json({ error: "Não autorizado" }, 401);
    }

    if (action === "generate_plan") return await generatePlan(supabase, body.member_id);
    if (action === "publish_plan") return await publishPlan(supabase, body.member_id);
    if (action === "nps_cron") return await npsCron(supabase);
    if (action === "risk_cron") return await riskCron(supabase, body.dry_run === true);
    if (action === "generate_deliverable") return await generateDeliverable(supabase, body);
    if (action === "create_group") return await createGroup(body.company_id);

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e: any) {
    console.error("board-engine error:", e);
    return json({ error: e.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Cria/reprocessa o grupo de WhatsApp do Board (proxy pra função do projeto Marcelo)
async function createGroup(companyId: string) {
  if (!companyId) return json({ error: "company_id obrigatório" }, 400);
  const secret = Deno.env.get("BOARD_GROUP_SECRET");
  if (!secret) return json({ error: "BOARD_GROUP_SECRET não configurada" }, 500);
  try {
    const r = await fetch("https://kktocqnwlmmxjzgmnxgs.supabase.co/functions/v1/marcelo-board-group", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-scheduler-secret": secret },
      body: JSON.stringify({ company_id: companyId }),
    });
    const data = await r.json().catch(() => ({}));
    return json(data, r.ok ? 200 : 500);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
}

// ─────────────────────────── GENERATE PLAN ───────────────────────────

async function generatePlan(supabase: any, memberId: string) {
  if (!memberId) return json({ error: "member_id obrigatório" }, 400);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY não configurada" }, 500);

  const { data: member, error: mErr } = await supabase
    .from("unv_board_members").select("*").eq("id", memberId).single();
  if (mErr || !member) return json({ error: "Membro não encontrado" }, 404);

  const { data: company } = await supabase
    .from("onboarding_companies")
    .select("name, segment, company_description, main_challenges, goals_short_term, goals_long_term, target_audience, competitors, sales_team_size, conversion_rate, average_ticket, acquisition_channels, has_structured_process, crm_usage, has_sales_goals")
    .eq("id", member.company_id).single();

  const { data: templates } = await supabase
    .from("unv_board_journey_templates")
    .select("phase, phase_name, month_offset, day_offset, title, description, deliverable_type")
    .eq("is_active", true)
    .order("phase").order("sort_order");

  if (!templates?.length) return json({ error: "Template-mãe vazio" }, 500);

  await supabase.from("unv_board_members").update({ plan_status: "generating" }).eq("id", memberId);

  // Contexto do CRM: transcrição da reunião de venda + proposta (dores reais do cliente)
  let crmContext = "";
  if (member.crm_lead_id) {
    const { data: lead } = await supabase
      .from("crm_leads")
      .select("name, company, segment, notes")
      .eq("id", member.crm_lead_id)
      .maybeSingle();
    const { data: transcription } = await supabase
      .from("crm_transcriptions")
      .select("summary, transcription_text, created_at")
      .eq("lead_id", member.crm_lead_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: proposal } = await supabase
      .from("crm_lead_proposals")
      .select("content, created_at")
      .eq("lead_id", member.crm_lead_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const parts: string[] = [];
    if (lead?.notes) parts.push(`ANOTAÇÕES DO LEAD: ${String(lead.notes).substring(0, 1500)}`);
    if (transcription?.summary) parts.push(`RESUMO DA REUNIÃO DE VENDA: ${String(transcription.summary).substring(0, 3000)}`);
    else if (transcription?.transcription_text) parts.push(`TRECHO DA TRANSCRIÇÃO DA REUNIÃO DE VENDA: ${String(transcription.transcription_text).substring(0, 4000)}`);
    if (proposal?.content) parts.push(`PROPOSTA APRESENTADA (contém as dores mapeadas): ${String(proposal.content).substring(0, 3000)}`);
    if (parts.length) {
      crmContext = `\n\nCONTEXTO DA VENDA (vem do CRM — são as dores REAIS ditas pelo cliente na reunião; use isso pra priorizar e especificar as ações):\n${parts.join("\n\n")}`;
    }
  }

  const profile = {
    empresa: company?.name,
    segmento: company?.segment || member.segment_snapshot || "não informado",
    descricao: company?.company_description,
    principais_desafios: company?.main_challenges,
    metas_curto_prazo: company?.goals_short_term,
    metas_longo_prazo: company?.goals_long_term,
    publico_alvo: company?.target_audience,
    concorrentes: company?.competitors,
    tamanho_time_vendas: company?.sales_team_size,
    taxa_conversao: company?.conversion_rate,
    ticket_medio: company?.average_ticket,
    canais_aquisicao: company?.acquisition_channels,
    processo_estruturado: company?.has_structured_process,
    uso_crm: company?.crm_usage,
    tem_metas: company?.has_sales_goals,
  };

  const prompt = `Você é o diretor comercial da UNV (Universidade Nacional de Vendas) e vai personalizar o plano anual de um cliente da mentoria UNV Board.

O plano segue o Método CRESCER em 7 fases: 1-Cenário, 2-Resultado Ideal, 3-Estrutura, 4-Sistema de Captação, 5-Conversão, 6-Escala, 7-Revisão.

PERFIL DA EMPRESA:
${JSON.stringify(profile, null, 2)}${crmContext}

TEMPLATE-MÃE (ações padrão do ano, offsets relativos à data de entrada):
${JSON.stringify(templates)}

SUA TAREFA: adaptar o template ao segmento e à realidade dessa empresa.
Regras:
- Mantenha a estrutura de fases e os month_offset. Pode ajustar day_offset em ±5 dias.
- REESCREVA títulos e descrições com a linguagem e os exemplos do segmento da empresa (ex.: clínica fala em "pacientes" e "agenda", varejo fala em "fluxo de loja" e "recompra", indústria/B2B fala em "carteira" e "prospecção").
- SUBSTITUA ações que não se aplicam ao segmento por equivalentes que resolvam o mesmo objetivo da fase (ex.: "cadência de prospecção B2B" numa clínica vira "protocolo de reativação de pacientes inativos").
- Se os desafios da empresa indicarem urgência em algum tema, torne as ações daquele tema mais específicas.
- Pode ADICIONAR até 5 ações novas se o perfil pedir (marque deliverable_type null nelas, a menos que gerem documento).
- Mantenha deliverable_type EXATAMENTE com os valores existentes: raiox, metas, icp, playbook, processos, script, calendario, book ou null.
- Descrições: 1 a 3 frases, direto ao ponto, tom prático de quem cobra execução, sem jargão corporativo.

RESPONDA SOMENTE com um array JSON válido (sem markdown, sem comentários), onde cada item tem: phase (int), phase_name, month_offset (int), day_offset (int), title, description, deliverable_type (string ou null).`;

  const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!aiResp.ok) {
    const errText = await aiResp.text();
    await supabase.from("unv_board_members").update({ plan_status: "pending" }).eq("id", memberId);
    return json({ error: `Anthropic ${aiResp.status}: ${errText.substring(0, 300)}` }, 500);
  }

  const aiData = await aiResp.json();
  const text = (aiData.content || []).map((b: any) => b.text || "").join("");
  let actions: any[];
  try {
    const match = text.match(/\[[\s\S]*\]/);
    actions = JSON.parse(match ? match[0] : text);
  } catch {
    await supabase.from("unv_board_members").update({ plan_status: "pending" }).eq("id", memberId);
    return json({ error: "IA não retornou JSON válido", raw: text.substring(0, 500) }, 500);
  }

  const validTypes = ["raiox", "metas", "icp", "playbook", "processos", "script", "calendario", "book", "outro"];

  // Regeneração: limpa drafts anteriores não publicados
  await supabase.from("unv_board_plan_actions").delete().eq("member_id", memberId).in("status", ["draft", "approved"]);

  const rows = actions
    .filter((a) => a?.title && Number.isInteger(a?.phase) && a.phase >= 1 && a.phase <= 7)
    .map((a) => ({
      member_id: memberId,
      phase: a.phase,
      phase_name: a.phase_name || null,
      due_date: computeDueDate(member.entry_date, a.month_offset ?? 0, a.day_offset ?? 0),
      title: String(a.title).substring(0, 300),
      description: a.description ? String(a.description).substring(0, 2000) : null,
      deliverable_type: validTypes.includes(a.deliverable_type) ? a.deliverable_type : null,
      status: "draft",
      origin: "ia",
    }));

  if (!rows.length) {
    await supabase.from("unv_board_members").update({ plan_status: "pending" }).eq("id", memberId);
    return json({ error: "IA retornou plano vazio" }, 500);
  }

  const { error: insErr } = await supabase.from("unv_board_plan_actions").insert(rows);
  if (insErr) {
    await supabase.from("unv_board_members").update({ plan_status: "pending" }).eq("id", memberId);
    return json({ error: `Erro ao salvar plano: ${insErr.message}` }, 500);
  }

  await supabase.from("unv_board_members").update({
    plan_status: "review",
    segment_snapshot: company?.segment || member.segment_snapshot,
  }).eq("id", memberId);

  return json({ success: true, actions_created: rows.length });
}

function computeDueDate(entryDate: string, monthOffset: number, dayOffset: number): string {
  const d = new Date(entryDate + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + monthOffset);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  // fim de semana empurra pra segunda
  const dow = d.getUTCDay();
  if (dow === 6) d.setUTCDate(d.getUTCDate() + 2);
  if (dow === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().substring(0, 10);
}

// ─────────────────────────── PUBLISH PLAN ───────────────────────────

async function publishPlan(supabase: any, memberId: string) {
  if (!memberId) return json({ error: "member_id obrigatório" }, 400);

  const { data: member } = await supabase.from("unv_board_members").select("*").eq("id", memberId).single();
  if (!member) return json({ error: "Membro não encontrado" }, 404);

  const { data: company } = await supabase
    .from("onboarding_companies").select("id, name, cs_id, consultant_id").eq("id", member.company_id).single();

  const { data: actions } = await supabase
    .from("unv_board_plan_actions")
    .select("*")
    .eq("member_id", memberId)
    .in("status", ["draft", "approved"])
    .order("due_date");

  if (!actions?.length) return json({ error: "Nenhuma ação pendente de publicação" }, 400);

  // Cria o projeto Board da empresa se ainda não existe
  let projectId = member.project_id;
  if (!projectId) {
    const entry = new Date(member.entry_date + "T12:00:00Z");
    const end = new Date(entry);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    const { data: proj, error: pErr } = await supabase
      .from("onboarding_projects")
      .insert({
        onboarding_company_id: member.company_id,
        product_id: "unv-board",
        product_name: "UNV Board",
        status: "active",
        contract_start_date: member.entry_date,
        contract_end_date: end.toISOString().substring(0, 10),
        cs_id: company?.cs_id || null,
        consultant_id: company?.consultant_id || null,
      })
      .select("id")
      .single();
    if (pErr) return json({ error: `Erro ao criar projeto: ${pErr.message}` }, 500);
    projectId = proj.id;
    await supabase.from("unv_board_members").update({ project_id: projectId }).eq("id", memberId);
  }

  let published = 0;
  for (const a of actions) {
    // Token do formulário público nasce junto com a tarefa (link vai na descrição)
    const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
    const formUrl = `${PUBLIC_DOMAIN}/#/board/tarefa/${token}`;
    const descParts = [a.description || ""];
    if (a.deliverable_type) {
      descParts.push(`\n\n[UNV Board] Esta ação gera o documento oficial: ${deliverableLabel(a.deliverable_type)}.`);
    }
    const { data: task, error: tErr } = await supabase
      .from("onboarding_tasks")
      .insert({
        project_id: projectId,
        title: a.title,
        description: descParts.join(""),
        due_date: a.due_date,
        status: "pending",
        tags: ["unv-board", a.phase_name || `Fase ${a.phase}`],
        board_form_url: formUrl,
      })
      .select("id")
      .single();
    if (tErr) {
      console.error(`Erro ao criar task "${a.title}":`, tErr.message);
      continue;
    }
    await supabase.from("unv_board_plan_actions")
      .update({ status: "published", task_id: task.id })
      .eq("id", a.id);
    // O trigger de autocreate pode ter criado o form com token próprio — força o nosso
    // (que já está na descrição) e o tipo certo
    await supabase.from("unv_board_task_forms").upsert(
      {
        task_id: task.id,
        member_id: memberId,
        token,
        form_type: a.deliverable_type || "diagnostico",
      },
      { onConflict: "task_id" }
    );
    published++;
  }

  await supabase.from("unv_board_members").update({ plan_status: "published" }).eq("id", memberId);

  return json({ success: true, project_id: projectId, tasks_created: published, total_actions: actions.length });
}

function deliverableLabel(type: string): string {
  const labels: Record<string, string> = {
    raiox: "Raio-X Comercial",
    metas: "Planejamento de Metas",
    icp: "ICP e Proposta de Valor",
    playbook: "Playbook Comercial",
    processos: "Processos Comerciais (POP)",
    script: "Script de Vendas",
    calendario: "Calendário Comercial",
    book: "Book do Ano",
    outro: "Documento",
  };
  return labels[type] || type;
}

// ─────────────────────── GENERATE DELIVERABLE ───────────────────────

const DELIVERABLE_SPECS: Record<string, { label: string; guidance: string }> = {
  playbook: {
    label: "Playbook Comercial",
    guidance: "Estruture o playbook comercial completo: posicionamento e proposta de valor; ICP resumido; processo de vendas etapa a etapa (com objetivo, ações e critério de saída de cada etapa); scripts-chave resumidos; principais objeções e contornos; regras de CRM; rotina comercial (diária/semanal); indicadores acompanhados. É o manual oficial de como se vende nessa empresa.",
  },
  processos: {
    label: "Processos Comerciais (POP)",
    guidance: "Documente os processos comerciais como POPs: pra cada processo informado, descreva objetivo, responsável, passo a passo numerado, prazo/SLA de cada passo, ferramenta usada e o que caracteriza o processo bem executado.",
  },
  script: {
    label: "Script de Vendas",
    guidance: "Escreva os scripts prontos pra uso: abertura/abordagem, perguntas de qualificação, apresentação de solução, contorno das objeções citadas (cada uma com resposta pronta) e fechamento. Linguagem falada, natural, adaptada ao segmento.",
  },
  icp: {
    label: "ICP e Proposta de Valor",
    guidance: "Documente o perfil de cliente ideal: quem é (segmento, porte, contexto), dores, ganhos esperados, onde está, quem decide, sinais de bom e mau fit (quem NÃO é cliente), e a proposta de valor com diferenciais e provas.",
  },
  metas: {
    label: "Planejamento de Metas",
    guidance: "Estruture o planejamento de metas: meta anual, quebra mensal (considerando sazonalidade), metas por vendedor quando houver time, premissas de conversão e ticket usadas na conta, e o ritual de acompanhamento do placar.",
  },
  calendario: {
    label: "Calendário Comercial",
    guidance: "Monte o calendário comercial: pra cada data/campanha informada, descreva a campanha, o público, a oferta sugerida, os canais e a data em que a preparação precisa começar (45 dias antes).",
  },
  raiox: {
    label: "Raio-X Comercial",
    guidance: "Estruture o diagnóstico comercial: situação atual por dimensão (estrutura, processo, funil, métricas, gestão), pontos fortes, gargalos priorizados por impacto, e recomendações objetivas. Atribua uma nota de 0 a 10 por dimensão e um escore geral de 0 a 70 (soma das 7 dimensões que avaliar).",
  },
  book: {
    label: "Book do Ano",
    guidance: "Compile o book anual: resumo executivo do ano, evolução das métricas informadas (antes vs depois), lista dos documentos/entregáveis construídos, principais conquistas e o direcionamento pro próximo ano.",
  },
  outro: { label: "Documento", guidance: "Estruture o documento de forma clara e profissional com base nas informações fornecidas." },
};

async function generateDeliverable(supabase: any, body: any) {
  const { member_id, type, form_data, title } = body;
  if (!member_id || !type || !form_data) return json({ error: "member_id, type e form_data obrigatórios" }, 400);
  const spec = DELIVERABLE_SPECS[type];
  if (!spec) return json({ error: `Tipo inválido: ${type}` }, 400);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY não configurada" }, 500);

  const { data: member } = await supabase.from("unv_board_members").select("*").eq("id", member_id).single();
  if (!member) return json({ error: "Membro não encontrado" }, 404);

  const { data: company } = await supabase
    .from("onboarding_companies")
    .select("name, segment, company_description, target_audience, average_ticket, sales_team_size")
    .eq("id", member.company_id).single();

  const prompt = `Você é o diretor comercial da UNV (Universidade Nacional de Vendas) e vai redigir um documento oficial pro cliente da mentoria UNV Board.

DOCUMENTO: ${spec.label}
EMPRESA: ${company?.name} — segmento: ${company?.segment || "não informado"}
CONTEXTO DA EMPRESA: ${JSON.stringify({ descricao: company?.company_description, publico: company?.target_audience, ticket_medio: company?.average_ticket, time_vendas: company?.sales_team_size })}

RESPOSTAS DO FORMULÁRIO (preenchido pelo cliente — é a matéria-prima do documento):
${JSON.stringify(form_data, null, 2)}

INSTRUÇÕES: ${spec.guidance}

REGRAS DE FORMA:
- Escreva em markdown limpo: títulos com ##, subtítulos com ###, listas com -. Sem tabelas complexas, sem emojis.
- Português do Brasil, tom profissional e direto, linguagem do segmento da empresa.
- Use SOMENTE as informações fornecidas; onde faltar informação, escreva a seção com orientação prática de como preencher (marcada como "A definir:").
- Não escreva preâmbulo nem comentários — comece direto no título do documento com # ${spec.label} — ${company?.name}.`;

  const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 12000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!aiResp.ok) {
    const errText = await aiResp.text();
    return json({ error: `Anthropic ${aiResp.status}: ${errText.substring(0, 300)}` }, 500);
  }
  const aiData = await aiResp.json();
  const content = (aiData.content || []).map((b: any) => b.text || "").join("").trim();
  if (content.length < 100) return json({ error: "IA retornou documento vazio" }, 500);

  // Versão = maior versão do tipo + 1
  const { data: prev } = await supabase
    .from("unv_board_deliverables")
    .select("version")
    .eq("member_id", member_id)
    .eq("type", type)
    .order("version", { ascending: false })
    .limit(1);
  const version = (prev?.[0]?.version || 0) + 1;

  const { data: row, error: insErr } = await supabase
    .from("unv_board_deliverables")
    .insert({
      member_id,
      company_id: member.company_id,
      type,
      title: title || `${spec.label} — ${company?.name}`,
      version,
      form_data,
      content_md: content,
      status: "draft",
    })
    .select("id, version")
    .single();
  if (insErr) return json({ error: insErr.message }, 500);

  return json({ success: true, deliverable_id: row.id, version: row.version, content_md: content });
}

// ──────────────── FORMULÁRIO PÚBLICO DE TAREFA (token = credencial) ────────────────

const EXECUTION_SPEC = {
  label: "Relatório de Execução",
  guidance:
    "Estruture o relatório de execução da ação: o que era a ação e o objetivo dela; o que foi feito na prática (passo a passo do que o cliente relatou); resultados obtidos (números quando houver); dificuldades encontradas e como foram tratadas; pendências e próximos passos recomendados. Feche com um parecer curto de qualidade da execução.",
};

const DIAGNOSTIC_SPEC = {
  label: "Relatório de Diagnóstico",
  guidance:
    "Estruture o diagnóstico do tema da ação: situação atual (retrato fiel do que o cliente respondeu, organizado); PROBLEMAS CONSTATADOS (seção central — cada problema com evidência tirada das respostas e o impacto comercial dele, priorizados do mais grave pro menos grave); pontos fortes a preservar; e recomendações objetivas. Seja direto: diagnóstico bom aponta a ferida.",
};

async function loadFormByToken(supabase: any, token: string) {
  if (!token || String(token).length < 20) return null;
  const { data: form } = await supabase
    .from("unv_board_task_forms")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  return form;
}

async function getTaskForm(supabase: any, token: string) {
  const form = await loadFormByToken(supabase, token);
  if (!form) return json({ error: "Formulário não encontrado" }, 404);

  const { data: task } = await supabase
    .from("onboarding_tasks")
    .select("id, title, description, due_date, status")
    .eq("id", form.task_id)
    .single();
  const { data: member } = await supabase
    .from("unv_board_members")
    .select("id, company_id")
    .eq("id", form.member_id)
    .single();
  const { data: company } = await supabase
    .from("onboarding_companies")
    .select("name, segment")
    .eq("id", member?.company_id)
    .single();

  // Limpa o link técnico da descrição mostrada ao cliente
  const cleanDesc = (task?.description || "")
    .replace(/\nExecute pelo formulário oficial:.*$/s, "")
    .trim();

  // Diagnóstico: as perguntas são específicas do assunto da tarefa, geradas por IA
  // na primeira abertura e congeladas no formulário
  let questions = form.questions || null;
  if (form.form_type === "diagnostico" && !questions && form.status === "pending" && ANTHROPIC_API_KEY) {
    try {
      questions = await generateDiagnosticQuestions(task, company);
      if (questions?.length) {
        await supabase.from("unv_board_task_forms").update({ questions }).eq("id", form.id);
      }
    } catch (e) {
      console.error("generateDiagnosticQuestions falhou:", e);
    }
  }

  return json({
    success: true,
    form_type: form.form_type,
    status: form.status,
    submitted_at: form.submitted_at,
    deliverable_id: form.deliverable_id,
    questions,
    task: { title: task?.title, description: cleanDesc, due_date: task?.due_date, status: task?.status },
    company_name: company?.name,
  });
}

async function generateDiagnosticQuestions(task: any, company: any): Promise<any[]> {
  const prompt = `Você é o diretor comercial da UNV. O cliente ${company?.name} (segmento: ${company?.segment || "n/i"}) vai executar esta ação da mentoria UNV Board respondendo um formulário de diagnóstico:

AÇÃO: ${task?.title}
CONTEXTO: ${(task?.description || "").substring(0, 600)}

Crie de 5 a 8 perguntas objetivas que levantem as INFORMAÇÕES REAIS necessárias pra essa ação — perguntas que um dono de PME consegue responder de cabeça ou consultando rapidamente seus números. Adapte a linguagem ao segmento. As respostas vão alimentar um relatório de diagnóstico que constata problemas e propõe ações.

RESPONDA SOMENTE com um array JSON válido (sem markdown), cada item: {"key": "slug-curto", "label": "pergunta clara", "placeholder": "Ex.: exemplo concreto do segmento", "type": "textarea"} (use "text" só pra respostas de uma linha, "list" quando a resposta natural é uma lista — nesse caso o placeholder avisa 'um item por linha').`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  const text = (data.content || []).map((b: any) => b.text || "").join("");
  const match = text.match(/\[[\s\S]*\]/);
  const parsed = JSON.parse(match ? match[0] : text);
  return Array.isArray(parsed)
    ? parsed.filter((q) => q?.key && q?.label).slice(0, 8).map((q) => ({
        key: String(q.key), label: String(q.label),
        placeholder: q.placeholder ? String(q.placeholder) : "",
        type: ["text", "textarea", "list"].includes(q.type) ? q.type : "textarea",
      }))
    : [];
}

async function submitTaskForm(supabase: any, body: any) {
  const { token, form_data } = body;
  if (!form_data) return json({ error: "form_data obrigatório" }, 400);
  const form = await loadFormByToken(supabase, token);
  if (!form) return json({ error: "Formulário não encontrado" }, 404);
  if (form.status === "submitted") return json({ error: "Esta tarefa já foi concluída" }, 409);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY não configurada" }, 500);

  const { data: member } = await supabase
    .from("unv_board_members").select("*").eq("id", form.member_id).single();
  const { data: company } = await supabase
    .from("onboarding_companies")
    .select("name, segment, company_description, target_audience, average_ticket, sales_team_size")
    .eq("id", member.company_id).single();
  const { data: task } = await supabase
    .from("onboarding_tasks")
    .select("title, description")
    .eq("id", form.task_id).single();

  const isExecution = form.form_type === "execucao";
  const spec = isExecution
    ? EXECUTION_SPEC
    : DELIVERABLE_SPECS[form.form_type] || DIAGNOSTIC_SPEC;

  // Memória do cliente no Board: documentos anteriores + resultados atribuídos.
  // Cada mês o sistema conhece mais o negócio — e o documento novo cita o histórico.
  let historyBlock = "";
  try {
    const { data: prevDocs } = await supabase
      .from("unv_board_deliverables")
      .select("title, type, created_at, content_md")
      .eq("member_id", form.member_id)
      .neq("id", form.deliverable_id || "00000000-0000-0000-0000-000000000000")
      .order("created_at", { ascending: false })
      .limit(4);
    const { data: prevResults } = await supabase
      .from("unv_board_results")
      .select("description, value_brl, metric_text, reported_at")
      .eq("member_id", form.member_id)
      .order("reported_at", { ascending: false })
      .limit(12);
    const parts: string[] = [];
    if (prevDocs?.length) {
      parts.push("DOCUMENTOS ANTERIORES DO CLIENTE NO BOARD (cite números e fatos deles quando relevante — mostre evolução):");
      for (const d of prevDocs) {
        parts.push(`- [${(d.created_at || "").substring(0, 10)}] ${d.title}: ${String(d.content_md || "").replace(/\s+/g, " ").substring(0, 400)}`);
      }
    }
    if (prevResults?.length) {
      parts.push("RESULTADOS JÁ REPORTADOS PELO CLIENTE:");
      for (const r of prevResults) {
        parts.push(`- ${r.description}${r.value_brl ? ` (R$ ${Number(r.value_brl).toLocaleString("pt-BR")})` : ""}${r.metric_text ? ` [${r.metric_text}]` : ""}`);
      }
    }
    if (parts.length) historyBlock = `\n\nHISTÓRICO DO CLIENTE NO BOARD:\n${parts.join("\n")}`;
  } catch (e) {
    console.error("histórico não carregado:", e);
  }

  // Relatório de execução: extrai também os RESULTADOS estruturados (alimenta o painel de ROI)
  const resultsBlock = isExecution
    ? `

DEPOIS do documento, escreva a linha exata ===RESULTADOS=== e em seguida SOMENTE um array JSON com os resultados mensuráveis relatados pelo cliente (pode ser vazio []): cada item {"descricao": "resultado em 1 frase", "valor_brl": número em reais quando o resultado for financeiro (senão null), "metrica": "métrica e valor (ex.: tempo de resposta 2h -> 15min)"}. Extraia SOMENTE o que o cliente relatou — não invente número.`
    : "";

  // Documento estratégico sai junto com o plano de ação PROPOSTO (o cliente edita antes de finalizar)
  const actionsBlock = isExecution
    ? resultsBlock
    : `

DEPOIS do documento, escreva a linha exata ===ACOES=== e em seguida SOMENTE um array JSON com o plano de ação: 3 a 5 ações SMART extraídas dos problemas constatados, cada item {"title": "ação curta com verbo (máx 90 chars)", "description": "o que fazer na prática, 1-3 frases", "metric": "métrica de resultado esperada", "days": prazo em dias a partir de hoje (int, entre 5 e 45, escalonados)}. As ações devem atacar os problemas do diagnóstico em ordem de impacto.`;

  const prompt = `Você é o diretor comercial da UNV (Universidade Nacional de Vendas) e vai redigir um documento oficial pro cliente da mentoria UNV Board, a partir da execução de uma ação do plano anual.

DOCUMENTO: ${spec.label}
AÇÃO DO PLANO: ${task?.title}
CONTEXTO DA AÇÃO: ${(task?.description || "").replace(/\nExecute pelo formulário oficial:.*$/s, "").substring(0, 800)}
EMPRESA: ${company?.name} — segmento: ${company?.segment || "não informado"}
CONTEXTO DA EMPRESA: ${JSON.stringify({ descricao: company?.company_description, publico: company?.target_audience, ticket_medio: company?.average_ticket, time_vendas: company?.sales_team_size })}

RESPOSTAS DO FORMULÁRIO (preenchido pelo cliente — é a matéria-prima do documento):
${JSON.stringify(form_data, null, 2)}${historyBlock}

INSTRUÇÕES: ${spec.guidance}

REGRAS DE FORMA:
- Markdown limpo: títulos com ##, subtítulos com ###, listas com -. Sem tabelas complexas, sem emojis.
- Português do Brasil, tom profissional e direto, linguagem do segmento da empresa.
- Use SOMENTE as informações fornecidas; onde faltar, escreva a seção com orientação prática marcada como "A definir:".
- Comece direto no título: # ${spec.label} — ${company?.name}.${actionsBlock}`;

  const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 14000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!aiResp.ok) {
    const errText = await aiResp.text();
    return json({ error: `Anthropic ${aiResp.status}: ${errText.substring(0, 300)}` }, 500);
  }
  const aiData = await aiResp.json();
  const raw = (aiData.content || []).map((b: any) => b.text || "").join("").trim();

  // Separa documento, plano de ação proposto e resultados estruturados
  let content = raw;
  let proposedActions: any[] = [];
  let extractedResults: any[] = [];
  const splitIdx = raw.indexOf("===ACOES===");
  if (splitIdx >= 0) {
    content = raw.substring(0, splitIdx).trim();
    try {
      const jsonPart = raw.substring(splitIdx + "===ACOES===".length);
      const match = jsonPart.match(/\[[\s\S]*\]/);
      if (match) {
        proposedActions = JSON.parse(match[0])
          .filter((a: any) => a?.title)
          .slice(0, 5)
          .map((a: any) => ({
            title: String(a.title).substring(0, 200),
            description: a.description ? String(a.description).substring(0, 800) : "",
            metric: a.metric ? String(a.metric).substring(0, 200) : "",
            days: Math.min(60, Math.max(3, parseInt(a.days) || 14)),
          }));
      }
    } catch (e) {
      console.error("Falha ao parsear plano de ação proposto:", e);
    }
  }
  const resIdx = raw.indexOf("===RESULTADOS===");
  if (resIdx >= 0) {
    if (resIdx < (splitIdx < 0 ? raw.length : splitIdx)) content = raw.substring(0, resIdx).trim();
    try {
      const jsonPart = raw.substring(resIdx + "===RESULTADOS===".length);
      const match = jsonPart.match(/\[[\s\S]*?\]/);
      if (match) {
        extractedResults = JSON.parse(match[0])
          .filter((r: any) => r?.descricao)
          .slice(0, 10)
          .map((r: any) => ({
            description: String(r.descricao).substring(0, 400),
            value_brl: typeof r.valor_brl === "number" && isFinite(r.valor_brl) ? r.valor_brl : null,
            metric_text: r.metrica ? String(r.metrica).substring(0, 200) : null,
          }));
      }
    } catch (e) {
      console.error("Falha ao parsear resultados:", e);
    }
  }
  if (content.length < 100) return json({ error: "IA retornou documento vazio" }, 500);

  const validTypes = ["raiox", "metas", "icp", "playbook", "processos", "script", "calendario", "book", "outro"];
  const dType = validTypes.includes(form.form_type) ? form.form_type : "outro";

  const { data: prev } = await supabase
    .from("unv_board_deliverables")
    .select("version")
    .eq("member_id", form.member_id)
    .eq("type", dType)
    .order("version", { ascending: false })
    .limit(1);
  const version = (prev?.[0]?.version || 0) + 1;

  const { data: row, error: insErr } = await supabase
    .from("unv_board_deliverables")
    .insert({
      member_id: form.member_id,
      company_id: member.company_id,
      type: dType,
      title: `${spec.label} — ${task?.title}`,
      version,
      form_data,
      content_md: content,
      status: "draft",
      task_id: form.task_id,
    })
    .select("id, version")
    .single();
  if (insErr) return json({ error: insErr.message }, 500);

  await supabase.from("unv_board_task_forms")
    .update({ form_data, deliverable_id: row.id, proposed_actions: proposedActions.length ? proposedActions : null })
    .eq("id", form.id);

  // Resultados estruturados alimentam o painel de ROI atribuído.
  // Regeneração ("voltar e ajustar") substitui os resultados do mesmo formulário.
  if (isExecution) {
    await supabase.from("unv_board_results").delete().eq("task_id", form.task_id);
    if (extractedResults.length) {
      await supabase.from("unv_board_results").insert(
        extractedResults.map((r) => ({
          member_id: form.member_id,
          company_id: member.company_id,
          task_id: form.task_id,
          deliverable_id: row.id,
          ...r,
        }))
      );
    }
  }

  return json({
    success: true,
    deliverable_id: row.id,
    version: row.version,
    content_md: content,
    doc_label: spec.label,
    company_name: company?.name,
    proposed_actions: proposedActions,
  });
}

async function attachTaskPdf(supabase: any, body: any) {
  const { token, deliverable_id, pdf_base64, file_name, actions } = body;
  if (!deliverable_id || !pdf_base64) return json({ error: "deliverable_id e pdf_base64 obrigatórios" }, 400);
  const form = await loadFormByToken(supabase, token);
  if (!form) return json({ error: "Formulário não encontrado" }, 404);
  if (form.deliverable_id !== deliverable_id) return json({ error: "Documento não pertence a esta tarefa" }, 403);

  const { data: member } = await supabase
    .from("unv_board_members").select("company_id, project_id").eq("id", form.member_id).single();

  const bytes = Uint8Array.from(atob(pdf_base64), (c) => c.charCodeAt(0));
  if (bytes.length > 15 * 1024 * 1024) return json({ error: "PDF muito grande" }, 413);

  const safeName = (file_name || "documento.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");

  // 1) Biblioteca do Board
  const boardPath = `${form.member_id}/tasks/${form.task_id}/${Date.now()}_${safeName}`;
  const { error: upErr } = await supabase.storage
    .from("board-deliverables")
    .upload(boardPath, bytes, { contentType: "application/pdf", upsert: true });
  if (upErr) return json({ error: `Upload: ${upErr.message}` }, 500);

  // 2) Anexo da tarefa dentro do projeto (padrão onboarding-documents)
  const docPath = `${member.company_id}/tasks/${form.task_id}/${Date.now()}_${safeName}`;
  const { error: docUpErr } = await supabase.storage
    .from("onboarding-documents")
    .upload(docPath, bytes, { contentType: "application/pdf", upsert: true });
  if (!docUpErr) {
    await supabase.from("onboarding_documents").insert({
      company_id: member.company_id,
      project_id: member.project_id,
      task_id: form.task_id,
      file_name: safeName,
      file_path: docPath,
      file_type: "application/pdf",
      file_size: bytes.length,
      category: "general",
      description: "Documento oficial UNV Board gerado pelo formulário da tarefa",
    });
  }

  // 3) Finaliza documento, formulário e TAREFA
  await supabase.from("unv_board_deliverables")
    .update({ pdf_path: boardPath, status: "final" })
    .eq("id", deliverable_id);
  await supabase.from("unv_board_task_forms")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", form.id);
  await supabase.from("onboarding_tasks")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", form.task_id);

  // 4) Plano de ação FINAL (editado pelo cliente na tela de revisão) vira tarefas
  //    novas do projeto — cada uma com formulário de execução próprio.
  //    Relatório de execução não cria ações (é o canal de resultado).
  let smartCreated = 0;
  if (form.form_type !== "execucao" && member.project_id && Array.isArray(actions) && actions.length) {
    try {
      smartCreated = await createActionTasks(supabase, form, member, deliverable_id, actions);
    } catch (e) {
      console.error("createActionTasks falhou (não bloqueia a conclusão):", e);
    }
  }

  return json({ success: true, task_completed: true, smart_actions_created: smartCreated });
}

// Cria as tarefas do plano de ação aprovado pelo cliente.
async function createActionTasks(supabase: any, form: any, member: any, deliverableId: string, actions: any[]): Promise<number> {
  const { data: deliverable } = await supabase
    .from("unv_board_deliverables")
    .select("title, content_md")
    .eq("id", deliverableId)
    .single();

  const clean = actions
    .filter((a: any) => a?.title && String(a.title).trim().length > 3)
    .slice(0, 7)
    .map((a: any) => ({
      title: String(a.title).trim().substring(0, 200),
      description: a.description ? String(a.description).trim().substring(0, 800) : "",
      metric: a.metric ? String(a.metric).trim().substring(0, 200) : "",
      days: Math.min(90, Math.max(1, parseInt(a.days) || 14)),
    }));
  if (!clean.length) return 0;

  let created = 0;
  for (const a of clean) {
    const due = new Date();
    due.setDate(due.getDate() + a.days);
    const dueStr = due.toISOString().substring(0, 10);

    const actionToken = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
    const formUrl = `${PUBLIC_DOMAIN}/#/board/tarefa/${actionToken}`;
    const desc = [
      a.description,
      a.metric ? `\nMétrica de resultado: ${a.metric}` : "",
      `\nOrigem: plano de ação do documento "${deliverable?.title || "UNV Board"}".`,
    ].join("");

    const { data: task, error: tErr } = await supabase
      .from("onboarding_tasks")
      .insert({
        project_id: member.project_id,
        title: a.title,
        description: desc,
        due_date: dueStr,
        status: "pending",
        tags: ["unv-board", "plano-smart"],
        board_form_url: formUrl,
      })
      .select("id")
      .single();
    if (tErr) continue;

    await supabase.from("unv_board_task_forms").upsert(
      { task_id: task.id, member_id: form.member_id, token: actionToken, form_type: "execucao" },
      { onConflict: "task_id" }
    );
    created++;
  }

  // Grava o plano final dentro do documento (o PDF do cliente já sai com ele)
  if (created && deliverable?.content_md && !deliverable.content_md.includes("## Plano de Ação")) {
    const planMd = [
      "\n\n## Plano de Ação",
      ...clean.map((a, i) => {
        const due = new Date();
        due.setDate(due.getDate() + a.days);
        const dd = `${String(due.getDate()).padStart(2, "0")}/${String(due.getMonth() + 1).padStart(2, "0")}`;
        return `\n### ${i + 1}. ${a.title}\n- O que fazer: ${a.description || "—"}\n- Métrica de resultado: ${a.metric || "—"}\n- Prazo: ${dd}`;
      }),
    ].join("");
    await supabase.from("unv_board_deliverables")
      .update({ content_md: deliverable.content_md + planMd })
      .eq("id", deliverableId);
  }

  return created;
}

// ─────────────────────────── RADAR DE RESGATE ───────────────────────────
// Semanal. Cliente com execução fraca ou NPS detrator = alerta pro Fabrício ANTES
// do pedido de cancelamento nascer (o padrão dos churns: desconexão 6-8 semanas antes).
const RISK_ALERT_PHONE = "5531989840003"; // Fabrício

async function riskCron(supabase: any, dryRun: boolean) {
  const results = { checked: 0, alerts: 0, previews: [] as any[], errors: [] as string[] };
  const today = new Date();
  const since28 = new Date(today.getTime() - 28 * 86400000).toISOString().substring(0, 10);
  const todayStr = today.toISOString().substring(0, 10);

  const { data: members } = await supabase
    .from("unv_board_members")
    .select("id, company_id, project_id, entry_date, owner_name, status, plan_status")
    .eq("status", "active")
    .eq("plan_status", "published");

  for (const m of members || []) {
    try {
      if (!m.project_id) continue;
      results.checked++;

      // Execução: tarefas com prazo nos últimos 28 dias
      const { data: dueTasks } = await supabase
        .from("onboarding_tasks")
        .select("id, status, due_date")
        .eq("project_id", m.project_id)
        .gte("due_date", since28)
        .lte("due_date", todayStr);
      const total = dueTasks?.length || 0;
      const done = (dueTasks || []).filter((t: any) => t.status === "completed").length;
      const execRate = total > 0 ? done / total : null;

      // Último NPS respondido
      const { data: lastNps } = await supabase
        .from("unv_board_nps")
        .select("score, answered_at")
        .eq("member_id", m.id)
        .eq("status", "answered")
        .order("answered_at", { ascending: false })
        .limit(1);
      const npsScore = lastNps?.[0]?.score ?? null;

      const lowExec = execRate !== null && total >= 3 && execRate < 0.6;
      const detractor = npsScore !== null && npsScore <= 6;
      if (!lowExec && !detractor) continue;

      // Máximo 1 alerta por membro a cada 14 dias
      const since14 = new Date(today.getTime() - 14 * 86400000).toISOString();
      const { data: recent } = await supabase
        .from("unv_board_risk_alerts")
        .select("id")
        .eq("member_id", m.id)
        .gte("sent_at", since14)
        .limit(1);
      if (recent?.length) continue;

      const { data: company } = await supabase
        .from("onboarding_companies").select("name").eq("id", m.company_id).single();

      const reasons: string[] = [];
      if (lowExec) reasons.push(`execução ${Math.round(execRate! * 100)}% nos últimos 28 dias (${done}/${total} tarefas)`);
      if (detractor) reasons.push(`último NPS: ${npsScore} (detrator)`);

      const message =
        `RADAR UNV BOARD — ${company?.name}\n\n` +
        `Sinal de risco: ${reasons.join(" e ")}.\n\n` +
        `Padrão de churn começa assim. Sugestão: call de resgate de 20 min com ${m.owner_name || "o dono"} essa semana, antes do encontro.\n\n` +
        `Painel: https://unvholdings.com.br/#/onboarding-tasks/board-unv`;

      if (dryRun) {
        results.previews.push({ empresa: company?.name, reasons });
        continue;
      }

      const instanceName = await getInstanceName(supabase, null);
      if (instanceName) {
        const send = await sendWhatsApp(supabase, instanceName, RISK_ALERT_PHONE, message);
        if (!send.success) results.errors.push(`${company?.name}: ${send.error}`);
      }
      await supabase.from("unv_board_risk_alerts").insert({
        member_id: m.id,
        reason: reasons.join("; "),
        exec_rate: execRate,
        last_nps: npsScore,
      });
      results.alerts++;
    } catch (e: any) {
      results.errors.push(`${m.id}: ${e.message}`);
    }
  }
  return json(results);
}

// ─────────────────────────── NPS CRON ───────────────────────────

async function npsCron(supabase: any) {
  const today = new Date();
  const results = { sent: 0, skipped: 0, reconciled: 0, errors: [] as string[] };

  const { data: members } = await supabase
    .from("unv_board_members")
    .select("id, company_id, project_id, entry_date, owner_name, owner_phone, status")
    .eq("status", "active");

  for (const m of members || []) {
    const days = daysBetween(new Date(m.entry_date + "T12:00:00Z"), today);
    if (days <= 0 || days % 30 !== 0) continue;
    const cycle = days;

    const { data: existing } = await supabase
      .from("unv_board_nps")
      .select("id")
      .eq("member_id", m.id)
      .eq("cycle_days", cycle)
      .maybeSingle();
    if (existing) continue;

    const phone = cleanPhone(m.owner_phone);
    if (!phone || !m.project_id) {
      await supabase.from("unv_board_nps").insert({
        member_id: m.id, company_id: m.company_id, cycle_days: cycle,
        due_date: today.toISOString().substring(0, 10), status: "skipped",
      });
      results.skipped++;
      continue;
    }

    const { data: company } = await supabase
      .from("onboarding_companies").select("name").eq("id", m.company_id).single();

    const months = Math.round(cycle / 30);
    const link = `${PUBLIC_DOMAIN}/#/nps?project=${encodeURIComponent(m.project_id)}`;
    const firstName = (m.owner_name || "").split(" ")[0];
    const message =
      `${firstName ? firstName + ", " : ""}hoje completa ${months} ${months === 1 ? "mês" : "meses"} de UNV Board da ${company?.name || "sua empresa"}.\n\n` +
      `De 0 a 10, o quanto você recomendaria o Board pra outro empresário?\n\n` +
      `Responda aqui, leva menos de 1 minuto: ${link}\n\n` +
      `Sua nota calibra como vamos te atender no próximo ciclo.`;

    const instanceName = await getInstanceName(supabase, null);
    let sendOk = false;
    let sendErr: string | null = null;
    if (instanceName) {
      const res = await sendWhatsApp(supabase, instanceName, phone, message);
      sendOk = res.success;
      sendErr = res.error || null;
    } else {
      sendErr = "Instância WhatsApp padrão não configurada";
    }

    await supabase.from("unv_board_nps").insert({
      member_id: m.id, company_id: m.company_id, cycle_days: cycle,
      due_date: today.toISOString().substring(0, 10),
      sent_at: sendOk ? new Date().toISOString() : null,
      status: sendOk ? "sent" : "pending",
    });
    if (sendOk) results.sent++;
    else if (sendErr) results.errors.push(`${company?.name}: ${sendErr}`);

    await new Promise((r) => setTimeout(r, 2000));
  }

  // Reconciliação: casa respostas do NPS público com os ciclos enviados
  const { data: pendingCycles } = await supabase
    .from("unv_board_nps")
    .select("id, member_id, sent_at, unv_board_members!inner(project_id)")
    .eq("status", "sent");

  for (const c of pendingCycles || []) {
    const projectId = (c as any).unv_board_members?.project_id;
    if (!projectId || !c.sent_at) continue;
    const { data: resp } = await supabase
      .from("onboarding_nps_responses")
      .select("score, feedback, created_at")
      .eq("project_id", projectId)
      .gte("created_at", c.sent_at)
      .order("created_at", { ascending: true })
      .limit(1);
    if (resp?.length) {
      await supabase.from("unv_board_nps").update({
        answered_at: resp[0].created_at,
        score: resp[0].score,
        feedback: resp[0].feedback,
        status: "answered",
      }).eq("id", c.id);
      results.reconciled++;
    }
  }

  return json({ success: true, ...results });
}

// ─────────────────────────── HELPERS (padrão survey-sender) ───────────────────────────

async function getInstanceName(supabase: any, configInstance: string | null): Promise<string | null> {
  if (configInstance) return configInstance;
  const { data } = await supabase
    .from("whatsapp_default_config")
    .select("setting_value")
    .eq("setting_key", "default_instance")
    .maybeSingle();
  return data?.setting_value || null;
}

async function sendWhatsApp(
  supabase: any,
  instanceName: string,
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, api_url, api_key")
      .eq("instance_name", instanceName)
      .eq("status", "connected")
      .single();

    if (!instance) return { success: false, error: "Instância não encontrada ou desconectada" };

    const EVOLUTION_API_URL = instance.api_url || Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = instance.api_key || Deno.env.get("EVOLUTION_API_KEY");
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return { success: false, error: "Evolution API credentials not configured" };
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
    const response = await fetch(`${baseUrl}/message/sendText/${instance.instance_name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
        Authorization: `Bearer ${EVOLUTION_API_KEY}`,
      },
      body: JSON.stringify({ number: phone, text: message }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errText.substring(0, 200)}` };
    }
    await response.text();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function cleanPhone(phone: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function daysBetween(d1: Date, d2: Date): number {
  const utc1 = Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth(), d1.getUTCDate());
  const utc2 = Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), d2.getUTCDate());
  return Math.floor((utc2 - utc1) / 86400000);
}
