// OniChat (Chatwoot white label) → KPIs do Nexus.
// Ações: { action: "discover", config_id } lista agentes, caixas, etiquetas, atributos e uma amostra
// de conversas pra desenhar o mapeamento; { action: "sync", config_id?, dias? } lança kpi_entries.
// Autenticação: api_token guardado na config; se não houver, faz /auth/sign_in com crm_login/crm_password
// do projeto (onboarding_projects) e guarda o access_token que o Chatwoot devolve.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const TAG = "[ONICHAT]";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const diaBR = (iso: string | number) => new Date((typeof iso === "number" ? iso * 1000 : new Date(iso).getTime()) - 3 * 3600000).toISOString().slice(0, 10);

type Cfg = { id: string; company_id: string; project_id: string | null; base_url: string; account_id: number; kpi_map: Record<string, string>; regras: Record<string, any>; api_token: string | null };

async function getToken(sb: any, cfg: Cfg): Promise<string> {
  if (cfg.api_token) return cfg.api_token;
  if (!cfg.project_id) throw new Error("config sem api_token e sem project_id pra fazer login");
  const { data: p } = await sb.from("onboarding_projects").select("crm_login, crm_password").eq("id", cfg.project_id).maybeSingle();
  if (!p?.crm_login || !p?.crm_password) throw new Error("projeto sem crm_login/crm_password");
  const r = await fetch(`${cfg.base_url}/auth/sign_in`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: String(p.crm_login).trim(), password: String(p.crm_password).trim() }),
  });
  if (!r.ok) throw new Error(`sign_in ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const token = j?.data?.access_token || r.headers.get("access-token");
  if (!token) throw new Error("sign_in sem access_token na resposta");
  await sb.from("onichat_sync_configs").update({ api_token: token }).eq("id", cfg.id);
  return token;
}

async function api(cfg: Cfg, token: string, path: string, init?: RequestInit) {
  const r = await fetch(`${cfg.base_url}/api/v1/accounts/${cfg.account_id}${path}`, {
    ...init, headers: { "Content-Type": "application/json", api_access_token: token, ...(init?.headers || {}) },
  });
  if (!r.ok) throw new Error(`${path} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// Filtro avançado do Chatwoot, todas as páginas (25 por página).
async function filtrar(cfg: Cfg, token: string, payload: any[], maxPaginas = 200) {
  const out: any[] = [];
  for (let page = 1; page <= maxPaginas; page++) {
    const j = await api(cfg, token, `/conversations/filter?page=${page}`, { method: "POST", body: JSON.stringify({ payload }) });
    const lista = j?.payload || [];
    out.push(...lista);
    if (lista.length < 25) break;
  }
  return out;
}
// Conversas criadas entre duas datas (YYYY-MM-DD, inclusive/exclusiva).
async function conversasCriadas(cfg: Cfg, token: string, desde: string, ate: string, maxPaginas = 200) {
  return filtrar(cfg, token, [
    { attribute_key: "created_at", filter_operator: "is_greater_than", values: [desde], query_operator: "AND" },
    { attribute_key: "created_at", filter_operator: "is_less_than", values: [ate], query_operator: null },
  ], maxPaginas);
}
const conversasDesde = (cfg: Cfg, token: string, desdeUnix: number, maxPaginas = 200) =>
  conversasCriadas(cfg, token, new Date(desdeUnix * 1000).toISOString().slice(0, 10), new Date(Date.now() + 86400000).toISOString().slice(0, 10), maxPaginas);

// Dia em que a etiqueta entrou na conversa: o Chatwoot grava uma mensagem de atividade
// ("fulano added contrato-fechado" / "adicionou"). Varre até 6 páginas de mensagens.
async function diaDaEtiqueta(cfg: Cfg, token: string, convId: number, label: string): Promise<string | null> {
  const alvo = norm(label);
  let before: number | null = null;
  for (let i = 0; i < 6; i++) {
    const j = await api(cfg, token, `/conversations/${convId}/messages${before ? `?before=${before}` : ""}`);
    const msgs: any[] = j?.payload || [];
    if (!msgs.length) break;
    const hit = msgs.filter((m) => m.message_type === 2 && norm(String(m.content || "")).includes(alvo)).sort((a, b) => b.created_at - a.created_at)[0];
    if (hit) return diaBR(hit.created_at);
    before = Math.min(...msgs.map((m) => m.id));
    if (msgs.length < 20) break;
  }
  return null;
}

// Auditoria: quantas conversas têm cada etiqueta "de fechamento" e em que mês a etiqueta entrou,
// mais as que têm link de contrato (ZapSign). Serve pra conferir se a regra de venda está estreita.
async function auditoriaVendas(sb: any, cfg: Cfg, labels: string[], attrLink: string) {
  const token = await getToken(sb, cfg);
  const out: Record<string, any> = {};
  for (const label of labels) {
    const convs = await filtrar(cfg, token, [{ attribute_key: "labels", filter_operator: "equal_to", values: [label], query_operator: null }], 20);
    const porMes: Record<string, number> = {}; const ids: any[] = [];
    for (const c of convs) {
      const dia = (await diaDaEtiqueta(cfg, token, c.id, label).catch(() => null)) || diaBR(c.last_activity_at || c.created_at) + "?";
      porMes[dia.slice(0, 7)] = (porMes[dia.slice(0, 7)] || 0) + 1;
      ids.push({ id: c.id, dia, assignee: c.meta?.assignee?.name, labels: c.labels, link: !!(c.custom_attributes || {})[attrLink] });
    }
    out[label] = { total: convs.length, por_mes: porMes, conversas: ids.slice(0, 60) };
  }
  if (attrLink) {
    const comLink = await filtrar(cfg, token, [{ attribute_key: attrLink, filter_operator: "is_present", values: [], query_operator: null, custom_attribute_type: "conversation_attribute" }], 20).catch((e) => ({ erro: String(e) }));
    out["com_" + attrLink] = Array.isArray(comLink) ? { total: comLink.length, conversas: comLink.slice(0, 60).map((c: any) => ({ id: c.id, criada: diaBR(c.created_at), ult: diaBR(c.last_activity_at || c.created_at), assignee: c.meta?.assignee?.name, labels: c.labels })) } : comLink;
  }
  return out;
}

// Busca termos nas mensagens (endpoint de busca do Chatwoot) e lista as conversas por mês.
async function buscaTermos(sb: any, cfg: Cfg, termos: string[]) {
  const token = await getToken(sb, cfg);
  const out: Record<string, any> = {};
  for (const termo of termos) {
    const vistos = new Map<number, any>();
    for (let page = 1; page <= 15; page++) {
      const j = await api(cfg, token, `/conversations/search?q=${encodeURIComponent(termo)}&page=${page}`).catch(() => null);
      const lista: any[] = j?.payload || [];
      for (const c of lista) if (!vistos.has(c.id)) vistos.set(c.id, c);
      if (lista.length < 25) break;
    }
    const porMes: Record<string, number> = {};
    const convs = [...vistos.values()].map((c: any) => {
      const m = (c.messages || [])[0];
      const dia = m?.created_at ? diaBR(m.created_at) : diaBR(c.last_activity_at || c.created_at);
      porMes[dia.slice(0, 7)] = (porMes[dia.slice(0, 7)] || 0) + 1;
      return { id: c.id, dia, assignee: c.meta?.assignee?.name, labels: c.labels, status: c.status, trecho: String(m?.content || "").replace(/\s+/g, " ").slice(0, 140) };
    });
    out[termo] = { total: convs.length, por_mes: porMes, conversas: convs.sort((a, b) => b.dia.localeCompare(a.dia)).slice(0, 80) };
  }
  // conversas resolvidas, por mês da última atividade
  const resolvidas = await filtrar(cfg, token, [{ attribute_key: "status", filter_operator: "equal_to", values: ["resolved"], query_operator: null }], 40);
  const porMesRes: Record<string, number> = {};
  resolvidas.forEach((c: any) => { const k = diaBR(c.last_activity_at || c.created_at).slice(0, 7); porMesRes[k] = (porMesRes[k] || 0) + 1; });
  out["resolvidas"] = { total: resolvidas.length, por_mes: porMesRes, amostra: resolvidas.slice(0, 20).map((c: any) => ({ id: c.id, ult: diaBR(c.last_activity_at || c.created_at), assignee: c.meta?.assignee?.name, labels: c.labels })) };
  return out;
}

// Mensagens de conversas específicas (tipo, remetente, trecho, dia), pra entender o fluxo de venda.
async function mensagensDe(sb: any, cfg: Cfg, ids: number[]) {
  const token = await getToken(sb, cfg);
  const out: Record<string, any> = {};
  for (const id of ids) {
    const todas: any[] = [];
    let before: number | null = null;
    for (let i = 0; i < 8; i++) {
      const j = await api(cfg, token, `/conversations/${id}/messages${before ? `?before=${before}` : ""}`).catch(() => null);
      const msgs: any[] = j?.payload || [];
      if (!msgs.length) break;
      todas.push(...msgs);
      before = Math.min(...msgs.map((m) => m.id));
      if (msgs.length < 20) break;
    }
    todas.sort((a, b) => a.created_at - b.created_at);
    out[id] = todas.map((m) => ({ d: new Date(m.created_at * 1000).toISOString().slice(0, 16), t: m.message_type, de: m.sender?.name || m.sender?.type || "", priv: m.private || undefined, c: String(m.content || m.content_attributes?.deleted && "(apagada)" || "").replace(/\s+/g, " ").slice(0, 110) + ((m.attachments || []).length ? " [anexo " + (m.attachments || []).map((a: any) => a.file_type).join(",") + "]" : "") }));
  }
  return out;
}

// Sonda: GET em caminhos da API da conta (pra mapear módulos fora do Chatwoot padrão, ex. Kanban).
async function sonda(sb: any, cfg: Cfg, paths: string[], limite = 6000) {
  const token = await getToken(sb, cfg);
  const out: Record<string, any> = {};
  for (const path of paths) {
    try {
      const r = await fetch(`${cfg.base_url}/api/v1/accounts/${cfg.account_id}${path}`, { headers: { api_access_token: token } });
      const txt = await r.text();
      out[path] = { status: r.status, corpo: txt.slice(0, limite) };
    } catch (e) { out[path] = { erro: String(e) }; }
  }
  return out;
}

// Cards do Kanban (módulo do OniChat) de um funil, nas etapas dadas, todas as páginas.
async function cardsKanban(cfg: Cfg, token: string, funnelId: number, stages: string[]) {
  const out: any[] = [];
  for (const stage of stages) {
    for (let page = 1; page <= 40; page++) {
      const j = await api(cfg, token, `/kanban_items?funnel_id=${funnelId}&stage_id=${encodeURIComponent(stage)}${page > 1 ? `&page=${page}` : ""}`);
      const itens: any[] = j?.items || j?.payload || [];
      out.push(...itens);
      const total = Number(j?.meta?.total_count ?? j?.meta?.count ?? NaN);
      if (!itens.length || (Number.isFinite(total) && out.length >= total)) break;
      if (itens.length < 10) break;
    }
  }
  return out;
}

async function discover(sb: any, cfg: Cfg) {
  const token = await getToken(sb, cfg);
  const [agents, inboxes, labels, attrs, teams] = await Promise.all([
    api(cfg, token, "/agents"), api(cfg, token, "/inboxes"), api(cfg, token, "/labels"),
    api(cfg, token, "/custom_attribute_definitions"), api(cfg, token, "/teams"),
  ]);
  const diasDesc = Number((cfg.regras || {}).discover_dias || 14);
  const desde = Math.floor(Date.now() / 1000) - diasDesc * 86400;
  const t0 = Date.now();
  const convs = await conversasDesde(cfg, token, desde, 12);
  console.log(`[onichat-sync] discover: ${convs.length} conversas em ${Date.now() - t0} ms`);
  const porLabel: Record<string, number> = {}; const porStatus: Record<string, number> = {}; const porAgente: Record<string, number> = {};
  const attrsVistos: Record<string, number> = {};
  for (const c of convs) {
    (c.labels || []).forEach((l: string) => porLabel[l] = (porLabel[l] || 0) + 1);
    porStatus[c.status] = (porStatus[c.status] || 0) + 1;
    const ag = c.meta?.assignee?.name || "(sem responsável)"; porAgente[ag] = (porAgente[ag] || 0) + 1;
    Object.keys(c.custom_attributes || {}).forEach((k) => attrsVistos[k] = (attrsVistos[k] || 0) + 1);
    Object.keys(c.meta?.sender?.custom_attributes || {}).forEach((k) => attrsVistos["contato." + k] = (attrsVistos["contato." + k] || 0) + 1);
  }
  const amostra = convs.slice(0, 5).map((c: any) => ({ id: c.id, status: c.status, labels: c.labels, created: diaBR(c.created_at), assignee: c.meta?.assignee?.name, inbox: c.inbox_id, custom_attributes: c.custom_attributes, contato_attrs: c.meta?.sender?.custom_attributes }));
  return {
    agentes: (agents || []).map((a: any) => ({ id: a.id, name: a.name, email: a.email, role: a.role })),
    caixas: (inboxes?.payload || []).map((i: any) => ({ id: i.id, name: i.name, channel: i.channel_type })),
    etiquetas: (labels?.payload || []).map((l: any) => ({ title: l.title, description: l.description })),
    atributos: (attrs || []).map((a: any) => ({ key: a.attribute_key, name: a.attribute_display_name, model: a.attribute_model, type: a.attribute_display_type })),
    times: (teams || []).map((t: any) => ({ id: t.id, name: t.name })),
    conversas_periodo: convs.length, dias: diasDesc, paginas_lidas_max: 12, por_label: porLabel, por_status: porStatus, por_agente: porAgente, atributos_vistos: attrsVistos, amostra,
  };
}

async function sync(sb: any, cfg: Cfg, dias: number, dryRun: boolean, janela?: { desde: string; ate: string }) {
  const token = await getToken(sb, cfg);
  const regras = cfg.regras || {};
  const labelVenda = norm(regras.label_venda || "");
  const attrValor = regras.attr_valor || "";
  const hojeBR = diaBR(Date.now() / 1000);
  // atendimentos: conversas CRIADAS na janela
  const desdeStr = janela?.desde || new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  const ateStr = janela?.ate || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const convs = await conversasCriadas(cfg, token, desdeStr, ateStr);
  // vendas: TODAS as conversas com a etiqueta de venda, seja quando for que nasceram
  // (a etiqueta entra semanas depois do primeiro contato). Cada conversa conta uma vez.
  const kanban = regras.kanban as { funnel_id: number; stages: string[] } | undefined;
  // sem kanban: cai na regra antiga (etiqueta)
  const vendidas = !kanban && labelVenda ? await filtrar(cfg, token, [{ attribute_key: "labels", filter_operator: "equal_to", values: [regras.label_venda], query_operator: null }]) : [];
  const cards = kanban ? await cardsKanban(cfg, token, Number(kanban.funnel_id), kanban.stages || ["contrato_fechado"]) : [];
  const agentes: any[] = kanban ? (await api(cfg, token, "/agents").catch(() => [])) : [];
  const agentePorId = new Map(agentes.map((a: any) => [Number(a.id), a]));

  // vendedores do Nexus (casa por e-mail, depois nome; fallback da config)
  const { data: sellers } = await sb.from("company_salespeople").select("id, name, email, unit_id, team_id, sector_id").eq("company_id", cfg.company_id);
  const porEmail = new Map((sellers || []).filter((s: any) => s.email).map((s: any) => [String(s.email).toLowerCase().trim(), s]));
  const porNome = new Map((sellers || []).map((s: any) => [norm(s.name), s]));
  const fallback = (sellers || []).find((s: any) => s.id === regras.vendedor_fallback) || null;
  const naoMapeados = new Set<string>();
  const vendedorDe = (c: any) => {
    const a = c.meta?.assignee;
    if (a?.email && porEmail.get(String(a.email).toLowerCase())) return porEmail.get(String(a.email).toLowerCase());
    if (a?.name) {
      const n = norm(a.name);
      if (porNome.get(n)) return porNome.get(n);
      for (const [k, s] of porNome) if (k && (n.startsWith(k) || k.startsWith(n))) return s;
      naoMapeados.add(a.name);
    }
    return fallback;
  };

  // acumula por (kpi, vendedor, dia)
  const soma = new Map<string, { kpi: string; sp: any; dia: string; valor: number }>();
  const add = (kpi: string, sp: any, dia: string, v: number) => {
    if (!sp || !cfg.kpi_map[kpi]) return;
    const k = `${kpi}|${sp.id}|${dia}`; const cur = soma.get(k) || { kpi, sp, dia, valor: 0 }; cur.valor += v; soma.set(k, cur);
  };
  const eventos: any[] = [];
  // PostgREST devolve no máximo 1000 linhas por chamada: paginar, senão os já contados
  // somem da lista e a rodada seguinte lança tudo de novo (aconteceu em 20/10: 163 vendas).
  const ja = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data: pag, error } = await sb.from("onichat_kpi_events").select("conversation_id, kpi").eq("config_id", cfg.id).order("created_at", { ascending: true }).range(from, from + 999);
    if (error) throw new Error("eventos: " + error.message);
    (pag || []).forEach((e: any) => ja.add(`${e.conversation_id}|${e.kpi}`));
    if (!pag || pag.length < 1000) break;
  }

  for (const c of convs) {
    const sp = vendedorDe(c);
    const diaCriacao = diaBR(c.created_at);
    if (!ja.has(`${c.id}|atendimentos`)) { add("atendimentos", sp, diaCriacao, 1); eventos.push({ config_id: cfg.id, conversation_id: c.id, kpi: "atendimentos", salesperson_id: sp?.id || null, entry_date: diaCriacao, value: 1 }); }
  }
  for (const c of vendidas) {
    const sp = vendedorDe(c);
    if (!ja.has(`${c.id}|vendas`)) {
      // dia da venda: o Chatwoot não guarda quando a etiqueta entrou. Usa a última atividade
      // da conversa se for recente (até 7 dias); senão lança no dia em que a sync viu.
      const ult = diaBR(c.last_activity_at || c.updated_at || c.created_at);
      let diaVenda = await diaDaEtiqueta(cfg, token, c.id, regras.label_venda).catch(() => null);
      if (!diaVenda) diaVenda = (Date.now() - new Date(ult).getTime()) <= 7 * 86400000 ? ult : hojeBR;
      add("vendas", sp, diaVenda, 1);
      eventos.push({ config_id: cfg.id, conversation_id: c.id, kpi: "vendas", salesperson_id: sp?.id || null, entry_date: diaVenda, value: 1 });
      const valor = Number(String((c.custom_attributes || {})[attrValor] ?? (c.meta?.sender?.custom_attributes || {})[attrValor] ?? "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", "."));
      if (attrValor && valor > 0) { add("faturamento", sp, diaVenda, valor); eventos.push({ config_id: cfg.id, conversation_id: c.id, kpi: "faturamento", salesperson_id: sp?.id || null, entry_date: diaVenda, value: valor }); }
    }
  }

  for (const it of cards) {
    const det = it.item_details || {};
    const ag = agentePorId.get(Number(det.attributed_to));
    const sp = vendedorDe({ meta: { assignee: ag ? { email: ag.email, name: ag.name } : null } });
    if (ja.has(`${it.id}|venda_kanban`)) continue;
    const diaVenda = diaBR(it.stage_entered_at || det.status_changed_at || it.updated_at || it.created_at);
    add("vendas", sp, diaVenda, 1);
    eventos.push({ config_id: cfg.id, conversation_id: it.id, kpi: "venda_kanban", salesperson_id: sp?.id || null, entry_date: diaVenda, value: 1 });
    const valor = Number(det.value || 0);
    if (valor > 0) { add("faturamento", sp, diaVenda, valor); eventos.push({ config_id: cfg.id, conversation_id: it.id, kpi: "fat_kanban", salesperson_id: sp?.id || null, entry_date: diaVenda, value: valor }); }
  }

  // soma o que já existe no dia (lançamento manual ou rodada anterior) e reescreve a linha do dia
  const planejado = [...soma.values()];
  let gravadas = 0;
  if (!dryRun) {
    // eventos primeiro: se a dedupe não gravar, não lança nada (evita contar duas vezes)
    for (let i = 0; i < eventos.length; i += 500) {
      const { error } = await sb.from("onichat_kpi_events").insert(eventos.slice(i, i + 500));
      if (error) throw new Error("gravar eventos: " + error.message);
    }
    for (const p of planejado) {
      const { data: atual } = await sb.from("kpi_entries").select("id, value").eq("company_id", cfg.company_id).eq("kpi_id", cfg.kpi_map[p.kpi]).eq("salesperson_id", p.sp.id).eq("entry_date", p.dia).maybeSingle();
      const linha = {
        company_id: cfg.company_id, kpi_id: cfg.kpi_map[p.kpi], salesperson_id: p.sp.id, entry_date: p.dia,
        value: Number(atual?.value || 0) + p.valor, unit_id: p.sp.unit_id ?? null, team_id: p.sp.team_id ?? null, sector_id: p.sp.sector_id ?? null,
        observations: `${TAG} sync automático do OniChat`,
      };
      const { error } = await sb.from("kpi_entries").upsert(linha, { onConflict: "salesperson_id,kpi_id,entry_date" });
      if (error) console.error("[onichat-sync] upsert:", error.message); else gravadas++;
    }

    await sb.from("onichat_sync_configs").update({ last_run_at: new Date().toISOString(), last_result: { conversas: convs.length, novos_eventos: eventos.length, linhas: planejado.length, nao_mapeados: [...naoMapeados] } }).eq("id", cfg.id);
  }
  return { dry_run: dryRun, janela: [desdeStr, ateStr], conversas_no_periodo: convs.length, com_etiqueta_venda: vendidas.length, cards_kanban: cards.length, novos_eventos: eventos.length, linhas_planejadas: planejado.length, gravadas, nao_mapeados: [...naoMapeados], sem_vendedor: !fallback && !(sellers || []).length, planejado: planejado.slice(0, 40).map((p) => ({ kpi: p.kpi, vendedor: p.sp.name, dia: p.dia, valor: p.valor })) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({} as any));
  try {
    let q = sb.from("onichat_sync_configs").select("*").eq("enabled", true);
    if (body.config_id) q = q.eq("id", body.config_id);
    const { data: cfgs, error } = await q;
    if (error) throw new Error("config: " + error.message);
    if (!cfgs?.length) return json({ error: "sem config" }, 404);
    const out: Record<string, unknown> = {};
    for (const cfg of cfgs as Cfg[]) {
      try {
        out[cfg.id] = body.action === "discover" ? await discover(sb, cfg)
          : body.action === "sonda" ? await sonda(sb, cfg, body.paths || [], Number(body.limite || 6000))
          : body.action === "mensagens" ? await mensagensDe(sb, cfg, (body.ids || []).map(Number))
          : body.action === "busca" ? await buscaTermos(sb, cfg, body.termos || [])
          : body.action === "auditoria_vendas" ? await auditoriaVendas(sb, cfg, body.labels || [], body.attr_link || "")
          : await sync(sb, cfg, Number(body.dias || 3), !!body.dry_run, body.desde && body.ate ? { desde: String(body.desde), ate: String(body.ate) } : undefined);
      } catch (e) {
        out[cfg.id] = { error: String(e).slice(0, 300) };
        // token vencido/inválido: limpa pra relogar na próxima
        if (/401/.test(String(e))) await sb.from("onichat_sync_configs").update({ api_token: null }).eq("id", cfg.id);
      }
    }
    return json(out);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
