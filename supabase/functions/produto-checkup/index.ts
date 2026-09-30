// produto-checkup — checkup diário do produto (entrega), de segunda a sexta.
// Pedido do Fabrício em 30/09/2026: uma rotina por bloco (grupos, tarefas,
// resultado, reuniões, NPS/CSAT, saúde, renovação, financeiro, consultores) em
// que cada bloco já abre o que precisa de atenção HOJE, calculado na hora pelo
// que está acontecendo. A pessoa trata, anota e marca o bloco como feito.
//
// Ações (POST {action}):
//   get        -> blocos com as pendências do dia + o que já foi marcado
//   bloco      -> marca/desmarca um bloco como feito {bloco, feito, nota}
//   item       -> marca/desmarca uma pendência como tratada {item, tratado, nota}
//   cobrar     -> cria tarefa pro consultor a partir de uma pendência
//   historico  -> aderência dos últimos dias úteis
//   resumo     -> (cron) manda o fechamento do dia no WhatsApp do Fabrício
//
// Acesso: staff admin, master ou cs (JWT do usuário). O cron usa x-checkup-secret.
// As tabelas produto_checkup_* não têm policy: só esta função (service role) mexe.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MARCELO_URL = Deno.env.get("MARCELO_SUPABASE_URL") || "";
const MARCELO_KEY = Deno.env.get("MARCELO_SERVICE_KEY") || "";
const CRON_SECRET = Deno.env.get("PRODUTO_CHECKUP_SECRET") || "";
const NOTIFY_PHONE = "5531989840003"; // Fabrício
const APP = "https://unvholdings.com.br";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-checkup-secret",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Limiares das regras (dias corridos, salvo indicação)
const GRUPO_PARADO_DIAS = 5;
const CLIENTE_SEM_RESPOSTA_HORAS = 3;
const RITMO_MINIMO = 0.7; // realizado / (meta proporcional aos dias úteis do mês)

const BLOCOS: { key: string; titulo: string; descricao: string }[] = [
  { key: "grupos_gestao", titulo: "Grupos de gestão", descricao: "Cliente esperando resposta e grupos parados." },
  { key: "grupos_vendedores", titulo: "Grupos de vendedores", descricao: "Time do cliente sem resposta e grupos parados." },
  { key: "tarefas", titulo: "Tarefas em atraso", descricao: "Tarefas vencidas nos projetos ativos, por empresa." },
  { key: "resultado", titulo: "Resultado", descricao: "Empresas sem lançar números e abaixo do ritmo da meta." },
  { key: "reunioes", titulo: "Reuniões", descricao: "Reuniões sem finalizar, no-show e empresas sem reunião recente." },
  { key: "satisfacao", titulo: "NPS e CSAT", descricao: "Notas baixas recentes que pedem retorno." },
  { key: "saude", titulo: "Saúde e risco", descricao: "Health score crítico, sinal de cancelamento e aviso prévio." },
  { key: "renovacao", titulo: "Renovação de contrato", descricao: "Contratos vencidos ou vencendo em até 45 dias." },
  { key: "financeiro", titulo: "Pagamento em atraso", descricao: "Faturas vencidas e empresas com cobrança bloqueada." },
  { key: "consultores", titulo: "Consultores", descricao: "Carga de pendências da carteira de cada consultor." },
];

type Item = {
  key: string; bloco: string; company_id: string | null; staff_id: string | null; project_id: string | null;
  empresa: string | null; consultor: string | null; consultant_id: string | null;
  gravidade: "alta" | "media" | "baixa"; titulo: string; detalhe: string | null;
};

const BRL = (cents: number) => (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dBR = (iso: string | null | undefined) => {
  if (!iso) return "";
  const s = String(iso).length <= 10 ? `${iso}T12:00:00-03:00` : String(iso);
  return new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
};
const diasDesde = (iso: string | null | undefined, hojeISO: string) => {
  if (!iso) return null;
  const a = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).getTime();
  const b = new Date(`${hojeISO}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
};
function diasUteis(deISO: string, ateISO: string) {
  let n = 0;
  const d = new Date(`${deISO}T12:00:00Z`), fim = new Date(`${ateISO}T12:00:00Z`);
  while (d <= fim) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; d.setUTCDate(d.getUTCDate() + 1); }
  return n;
}
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

async function gruposMarcelo(): Promise<any[]> {
  if (!MARCELO_URL || !MARCELO_KEY) return [];
  try {
    const r = await fetch(`${MARCELO_URL}/rest/v1/rpc/checkup_grupos`, {
      method: "POST",
      headers: { apikey: MARCELO_KEY, Authorization: `Bearer ${MARCELO_KEY}`, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!r.ok) { console.error("[produto-checkup] grupos:", r.status, await r.text()); return []; }
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } catch (e) { console.error("[produto-checkup] grupos erro:", e); return []; }
}

async function montar(supabase: any) {
  const [{ data: dados, error }, grupos] = await Promise.all([supabase.rpc("produto_checkup_dados"), gruposMarcelo()]);
  if (error) throw new Error(`produto_checkup_dados: ${error.message}`);
  const hoje: string = dados.dia;
  const emp = new Map<string, any>((dados.empresas || []).map((e: any) => [e.id, e]));
  const staff = new Map<string, any>((dados.staff || []).map((s: any) => [s.id, s]));
  const itens: Item[] = [];
  const add = (bloco: string, companyId: string | null, tipo: string, gravidade: Item["gravidade"], titulo: string, detalhe: string | null, extra: Partial<Item> = {}) => {
    const e = companyId ? emp.get(companyId) : null;
    if (companyId && !e) return; // empresa fora da carteira ativa
    itens.push({
      key: `${bloco}:${companyId || extra.staff_id || "geral"}:${tipo}`, bloco, company_id: companyId, staff_id: null,
      project_id: e?.project_id || null, empresa: e?.nome || null, consultor: e?.consultor || null, consultant_id: e?.consultant_id || null,
      gravidade, titulo, detalhe, ...extra,
    });
  };

  // ── Grupos (gestão e vendedores) ──────────────────────────────────────────
  const agora = Date.now();
  const comGrupo: Record<string, Set<string>> = { gestao: new Set(), vendedores: new Set() };
  for (const g of grupos) {
    const tipo = g.group_type === "gestao" ? "gestao" : "vendedores";
    const bloco = tipo === "gestao" ? "grupos_gestao" : "grupos_vendedores";
    if (!emp.has(g.company_id)) continue;
    comGrupo[tipo].add(g.company_id);
    const ult = g.ultima_msg ? new Date(g.ultima_msg).getTime() : null;
    const horas = ult ? (agora - ult) / 3600000 : null;
    if (ult && g.ultima_eh_equipe === false && horas! >= CLIENTE_SEM_RESPOSTA_HORAS && horas! <= 7 * 24) {
      const ha = horas! >= 24 ? `${Math.floor(horas! / 24)} dia(s)` : `${Math.floor(horas!)}h`;
      add(bloco, g.company_id, "sem_resposta", horas! >= 24 ? "alta" : "media", `Cliente sem resposta há ${ha}`,
        `${g.ultima_de || "Cliente"}: "${String(g.ultima_texto || "").replace(/\s+/g, " ").slice(0, 140)}"`);
    } else if (!ult || horas! >= GRUPO_PARADO_DIAS * 24) {
      add(bloco, g.company_id, "parado", "media", ult ? `Grupo parado há ${Math.floor(horas! / 24)} dias` : "Grupo sem mensagem nas últimas 3 semanas",
        g.ultima_equipe ? `Última fala da equipe em ${dBR(g.ultima_equipe)}` : "Sem fala da equipe no período");
    }
  }
  if (grupos.length) {
    for (const e of emp.values()) {
      if (!comGrupo.gestao.has(e.id)) add("grupos_gestao", e.id, "sem_grupo", "baixa", "Empresa sem grupo de gestão vinculado", "Vincule o grupo para o Marcelo e os resumos funcionarem.");
    }
  }

  // ── Tarefas em atraso ─────────────────────────────────────────────────────
  for (const t of dados.tarefas || []) {
    const d = diasDesde(t.mais_antiga, hoje) || 0;
    add("tarefas", t.company_id, "atraso", t.n >= 5 || d >= 14 ? "alta" : "media", `${plural(t.n, "tarefa atrasada", "tarefas atrasadas")}, a mais antiga há ${d} dias`,
      (t.exemplos || []).join(" · ") || null, { staff_id: t.resp || null });
  }

  // ── Resultado ─────────────────────────────────────────────────────────────
  for (const k of dados.kpi_sem_lancar || []) {
    const d = diasDesde(k.ultimo, hoje);
    add("resultado", k.company_id, "sem_lancar", d === null || d >= 10 ? "alta" : "media", d === null ? "Nunca lançou indicador" : `Sem lançar números há ${d} dias`,
      k.ultimo ? `Último lançamento em ${dBR(k.ultimo)}` : null);
  }
  const iniMes = `${hoje.slice(0, 8)}01`;
  const fimMes = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const fracao = diasUteis(iniMes, hoje) / Math.max(1, diasUteis(iniMes, fimMes));
  if (Number(hoje.slice(8, 10)) >= 5) {
    for (const k of dados.kpi_mes || []) {
      const meta = Number(k.meta) || 0, real = Number(k.realizado) || 0;
      if (meta <= 0) continue;
      const ritmo = real / (meta * fracao);
      if (ritmo < RITMO_MINIMO) {
        const pct = Math.round((real / meta) * 100);
        add("resultado", k.company_id, "abaixo_ritmo", ritmo < 0.4 ? "alta" : "media", `${pct}% da meta do mês, abaixo do ritmo esperado (${Math.round(fracao * 100)}%)`, `Indicador: ${k.kpi}`);
      }
    }
  }

  // ── Reuniões ──────────────────────────────────────────────────────────────
  for (const r of dados.reunioes_pendentes || []) {
    add("reunioes", r.company_id, "sem_finalizar", "media", `${plural(r.n, "reunião sem finalizar", "reuniões sem finalizar")}, a mais antiga de ${dBR(r.mais_antiga)}`,
      (r.titulos || []).join(" · ") || null, { staff_id: r.resp || null });
  }
  for (const r of dados.no_show || []) add("reunioes", r.company_id, "no_show", "alta", `No-show em ${dBR(r.ultima)}${r.n > 1 ? ` (${r.n} na semana)` : ""}`, "Cliente não compareceu, vale remarcar e entender o motivo.");
  for (const r of dados.sem_reuniao || []) {
    const d = r.ultima ? diasDesde(r.ultima, hoje) : null;
    add("reunioes", r.company_id, "sem_reuniao", d === null || d >= 45 ? "alta" : "media", d === null ? "Nenhuma reunião registrada e nenhuma agendada" : `Sem reunião há ${d} dias e nenhuma agendada`, null);
  }

  // ── NPS e CSAT ────────────────────────────────────────────────────────────
  (dados.nps || []).forEach((n: any, i: number) => add("satisfacao", n.company_id, `nps_${String(n.quando).slice(0, 10)}_${i}`, n.score <= 4 ? "alta" : "media",
    `NPS ${n.score} em ${dBR(n.quando)}${n.quem ? ` (${n.quem})` : ""}`, n.texto || null));
  (dados.csat || []).forEach((n: any, i: number) => add("satisfacao", n.company_id, `csat_${String(n.quando).slice(0, 10)}_${i}`, n.score <= 2 ? "alta" : "media",
    `CSAT ${n.score} de 5 em ${dBR(n.quando)}${n.quem ? ` (${n.quem})` : ""}`, n.texto || null));

  // ── Saúde e risco ─────────────────────────────────────────────────────────
  for (const s of dados.sinal_cancelamento || []) {
    add("saude", s.company_id, s.status === "notice_period" ? "aviso_previo" : "sinal_cancelamento", "alta",
      s.status === "notice_period" ? `Em aviso prévio${s.fim_aviso ? ` até ${dBR(s.fim_aviso)}` : ""}` : `Sinal de cancelamento em ${dBR(s.quando)}`, s.motivo || s.produto || null);
  }
  for (const s of dados.saude || []) {
    add("saude", s.company_id, "health", s.risco === "critical" ? "alta" : "media", `Health score ${Math.round(Number(s.score) || 0)} (${s.risco === "critical" ? "crítico" : "em risco"})`,
      s.tendencia ? `Tendência: ${s.tendencia}` : null);
  }

  // ── Renovação ─────────────────────────────────────────────────────────────
  for (const r of dados.renovacao || []) {
    const d = diasDesde(r.fim, hoje) || 0; // positivo = já venceu
    add("renovacao", r.company_id, `fim_${r.fim}`, d >= 0 || d >= -15 ? "alta" : "media", d > 0 ? `Contrato vencido há ${d} dias (${dBR(r.fim)})` : d === 0 ? "Contrato vence hoje" : `Contrato vence em ${-d} dias (${dBR(r.fim)})`,
      [r.produto, r.plano ? `plano ${r.plano}` : null].filter(Boolean).join(" · ") || null);
  }

  // ── Financeiro ────────────────────────────────────────────────────────────
  for (const f of dados.financeiro || []) {
    const d = diasDesde(f.mais_antiga, hoje) || 0;
    add("financeiro", f.company_id, "fatura_vencida", d >= 15 ? "alta" : "media", `${plural(f.n, "fatura vencida", "faturas vencidas")}, total ${BRL(f.total_cents)}`, `A mais antiga venceu em ${dBR(f.mais_antiga)} (${d} dias)`);
  }
  for (const b of dados.bloqueadas || []) add("financeiro", b.company_id, "bloqueada", "alta", "Empresa com cobrança bloqueada", null);

  // ── Consultores: carga da carteira ────────────────────────────────────────
  const porCons = new Map<string, Record<string, number>>();
  for (const it of itens) {
    if (!it.consultant_id) continue;
    const c = porCons.get(it.consultant_id) || {};
    c[it.bloco] = (c[it.bloco] || 0) + 1;
    if (it.gravidade === "alta") c.altas = (c.altas || 0) + 1;
    porCons.set(it.consultant_id, c);
  }
  const carteira = new Map<string, number>();
  for (const e of emp.values()) if (e.consultant_id) carteira.set(e.consultant_id, (carteira.get(e.consultant_id) || 0) + 1);
  for (const [cid, c] of porCons) {
    const total = Object.entries(c).filter(([k]) => k !== "altas").reduce((a, [, v]) => a + v, 0);
    const nome = staff.get(cid)?.nome || "Consultor";
    const partes = BLOCOS.filter((b) => c[b.key]).map((b) => `${b.titulo}: ${c[b.key]}`);
    itens.push({
      key: `consultores:${cid}:carga`, bloco: "consultores", company_id: null, staff_id: cid, project_id: null, empresa: null,
      consultor: nome, consultant_id: cid, gravidade: (c.altas || 0) >= 5 ? "alta" : (c.altas || 0) >= 1 ? "media" : "baixa",
      titulo: `${nome}: ${total} pendências em ${carteira.get(cid) || 0} empresas${c.altas ? `, ${c.altas} graves` : ""}`, detalhe: partes.join(" · "),
    });
  }
  const semConsultor = [...emp.values()].filter((e) => !e.consultant_id);
  if (semConsultor.length) {
    itens.push({ key: "consultores:geral:sem_consultor", bloco: "consultores", company_id: null, staff_id: null, project_id: null, empresa: null, consultor: null, consultant_id: null,
      gravidade: "media", titulo: `${plural(semConsultor.length, "empresa ativa sem consultor", "empresas ativas sem consultor")}`, detalhe: semConsultor.map((e) => e.nome).slice(0, 8).join(" · ") });
  }

  const ordem = { alta: 0, media: 1, baixa: 2 } as const;
  itens.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade] || String(a.empresa || a.consultor || "").localeCompare(String(b.empresa || b.consultor || "")));
  return { hoje, itens, gruposOk: grupos.length > 0 };
}

async function estadoDoDia(supabase: any, hoje: string, itens: Item[]) {
  const [{ data: bl }, { data: it }] = await Promise.all([
    supabase.from("produto_checkup_blocos").select("*").eq("dia", hoje),
    supabase.from("produto_checkup_itens").select("*").eq("dia", hoje),
  ]);
  // última anotação de dias anteriores pra mesma pendência (ela reaparece se continua aberta)
  const keys = itens.map((i) => i.key);
  const anteriores = new Map<string, any>();
  for (let i = 0; i < keys.length; i += 150) {
    const { data } = await supabase.from("produto_checkup_itens").select("item_key, dia, nota, tratado_por")
      .in("item_key", keys.slice(i, i + 150)).lt("dia", hoje).order("dia", { ascending: false }).limit(1000);
    for (const r of data || []) if (!anteriores.has(r.item_key)) anteriores.set(r.item_key, r);
  }
  return { blocos: new Map((bl || []).map((b: any) => [b.bloco, b])), itensHoje: new Map((it || []).map((x: any) => [x.item_key, x])), anteriores };
}

async function sendWhatsApp(supabase: any, text: string): Promise<boolean> {
  try {
    const { data: inst } = await supabase.from("whatsapp_instances").select("instance_name, api_url, api_key, provider_type")
      .eq("instance_name", "fabricionunnes").eq("status", "connected").maybeSingle();
    if (!inst?.api_url || !inst?.api_key) return false;
    let host = "";
    try { host = new URL(inst.api_url).hostname.toLowerCase(); } catch { /* noop */ }
    const isManagerV2 = inst.provider_type === "manager_v2" || host.endsWith(".stevo.chat");
    const url = isManagerV2
      ? `${inst.api_url.replace(/\/manager\/?$/i, "").replace(/\/+$/g, "")}/send/text`
      : `${inst.api_url.replace(/\/+$/g, "")}/message/sendText/${inst.instance_name}`;
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", apikey: inst.api_key }, body: JSON.stringify({ number: NOTIFY_PHONE, text }) });
    return r.ok;
  } catch (e) { console.error("[produto-checkup] whatsapp:", e); return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const body = await req.json().catch(() => ({} as any));
    const action = String(body.action || "get");

    // ── quem está chamando ──────────────────────────────────────────────────
    const viaCron = !!CRON_SECRET && req.headers.get("x-checkup-secret") === CRON_SECRET;
    let eu: any = null;
    if (!viaCron) {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u } = await supabase.auth.getUser(token);
      if (!u?.user) return json({ ok: false, erro: "Sessão inválida. Entre de novo." }, 401);
      const { data: st } = await supabase.from("onboarding_staff").select("id, name, role, is_active").eq("user_id", u.user.id).eq("is_active", true).maybeSingle();
      if (!st || !["admin", "master", "cs"].includes(st.role)) return json({ ok: false, erro: "Acesso restrito a CS e administradores." }, 403);
      eu = st;
    }
    if (action === "resumo" && !viaCron && eu?.role !== "master") return json({ ok: false, erro: "Só o master dispara o resumo." }, 403);

    if (action === "historico") {
      const desde = new Date(Date.now() - 35 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase.from("produto_checkup_blocos").select("dia, bloco, feito_por, feito_em, pendencias, tratadas").gte("dia", desde).order("dia", { ascending: false });
      const { data: st } = await supabase.from("onboarding_staff").select("id, name");
      const nomes = new Map((st || []).map((s: any) => [s.id, s.name]));
      const porDia = new Map<string, any>();
      for (const r of data || []) {
        const d = porDia.get(r.dia) || { dia: r.dia, feitos: 0, total: BLOCOS.length, pendencias: 0, tratadas: 0, quem: new Set<string>() };
        d.feitos++; d.pendencias += r.pendencias || 0; d.tratadas += r.tratadas || 0;
        if (r.feito_por) d.quem.add(nomes.get(r.feito_por) || "");
        porDia.set(r.dia, d);
      }
      return json({ ok: true, total_blocos: BLOCOS.length, dias: [...porDia.values()].map((d) => ({ ...d, quem: [...d.quem].filter(Boolean) })) });
    }

    const { hoje, itens, gruposOk } = await montar(supabase);
    const est = await estadoDoDia(supabase, hoje, itens);

    if (action === "bloco") {
      const bloco = String(body.bloco || "");
      if (!BLOCOS.some((b) => b.key === bloco)) return json({ ok: false, erro: "Bloco desconhecido." }, 400);
      if (body.feito === false) {
        await supabase.from("produto_checkup_blocos").delete().eq("dia", hoje).eq("bloco", bloco);
      } else {
        const doBloco = itens.filter((i) => i.bloco === bloco);
        const { error } = await supabase.from("produto_checkup_blocos").upsert({
          dia: hoje, bloco, feito_por: eu?.id || null, feito_em: new Date().toISOString(), nota: body.nota || null,
          pendencias: doBloco.length, tratadas: doBloco.filter((i) => est.itensHoje.has(i.key)).length,
        }, { onConflict: "dia,bloco" });
        if (error) throw new Error(error.message);
      }
      return json({ ok: true });
    }

    if (action === "item") {
      const it = itens.find((i) => i.key === body.item);
      if (!it) return json({ ok: false, erro: "Essa pendência não está mais aberta. Atualize a tela." }, 404);
      if (body.tratado === false) {
        await supabase.from("produto_checkup_itens").delete().eq("dia", hoje).eq("item_key", it.key);
      } else {
        const { error } = await supabase.from("produto_checkup_itens").upsert({
          dia: hoje, item_key: it.key, bloco: it.bloco, company_id: it.company_id, staff_id: it.staff_id || it.consultant_id, titulo: it.titulo,
          tratado_por: eu?.id || null, tratado_em: new Date().toISOString(), nota: body.nota || null,
        }, { onConflict: "dia,item_key" });
        if (error) throw new Error(error.message);
      }
      return json({ ok: true });
    }

    if (action === "cobrar") {
      const it = itens.find((i) => i.key === body.item);
      if (!it) return json({ ok: false, erro: "Essa pendência não está mais aberta. Atualize a tela." }, 404);
      const responsavel = body.staff_id || it.staff_id || it.consultant_id;
      if (!it.project_id) return json({ ok: false, erro: "Essa pendência não está ligada a um projeto, não dá pra criar tarefa." }, 400);
      if (!responsavel) return json({ ok: false, erro: "Essa empresa não tem consultor definido." }, 400);
      const venc = new Date(`${hoje}T12:00:00Z`);
      do { venc.setUTCDate(venc.getUTCDate() + 1); } while ([0, 6].includes(venc.getUTCDay()));
      const titulo = String(body.titulo || `Checkup: ${it.titulo}`).slice(0, 200);
      const descricao = [body.descricao, it.detalhe, `Aberta no checkup diário do produto por ${eu?.name || "sistema"} em ${dBR(hoje)}.`].filter(Boolean).join("\n\n");
      const { data: tarefa, error } = await supabase.from("onboarding_tasks").insert({
        project_id: it.project_id, title: titulo, description: descricao, due_date: venc.toISOString().slice(0, 10), status: "pending",
        responsible_staff_id: responsavel, is_internal: true,
      }).select("id").single();
      if (error) throw new Error(`criar tarefa: ${error.message}`);
      await supabase.from("onboarding_notifications").insert({
        staff_id: responsavel, project_id: it.project_id, type: "task_assigned", title: "Nova tarefa do checkup do produto",
        message: `${it.empresa || ""}: ${it.titulo}`, reference_id: tarefa.id, reference_type: "task",
      }).then(() => {}, () => {});
      await supabase.from("produto_checkup_itens").upsert({
        dia: hoje, item_key: it.key, bloco: it.bloco, company_id: it.company_id, staff_id: responsavel, titulo: it.titulo,
        tratado_por: eu?.id || null, tratado_em: new Date().toISOString(), nota: body.nota || "Tarefa criada para o consultor.", tarefa_id: tarefa.id,
      }, { onConflict: "dia,item_key" });
      return json({ ok: true, tarefa_id: tarefa.id });
    }

    // visão montada (get e resumo)
    const blocos = BLOCOS.map((b) => {
      const doBloco = itens.filter((i) => i.bloco === b.key).map((i) => {
        const t: any = est.itensHoje.get(i.key);
        const ant: any = est.anteriores.get(i.key);
        return { ...i, tratado: !!t, nota: t?.nota || null, tarefa_id: t?.tarefa_id || null, anterior: ant ? { dia: ant.dia, nota: ant.nota } : null };
      });
      const f: any = est.blocos.get(b.key);
      return { ...b, feito: !!f, feito_em: f?.feito_em || null, nota: f?.nota || null, pendencias: doBloco.length, tratadas: doBloco.filter((i) => i.tratado).length, itens: doBloco };
    });

    if (action === "resumo") {
      const wd = new Date(`${hoje}T12:00:00Z`).getUTCDay();
      if ((wd === 0 || wd === 6) && !body.forcar) return json({ ok: true, skip: "fim de semana" });
      const feitos = blocos.filter((b) => b.feito).length;
      const abertas = blocos.reduce((a, b) => a + (b.pendencias - b.tratadas), 0);
      const linhas = [
        `*Checkup do produto* ${dBR(hoje)}`,
        `Rotina: ${feitos} de ${blocos.length} blocos feitos${feitos === blocos.length ? "" : ", incompleta"}`,
        `Pendências abertas: ${abertas}`,
        "",
        ...blocos.map((b) => `${b.feito ? "Feito" : "NÃO FEITO"} · ${b.titulo}: ${b.pendencias - b.tratadas} abertas de ${b.pendencias}`),
        "",
        `${APP}/#/onboarding-tasks/checkup`,
      ];
      if (body.dry_run) return json({ ok: true, dry_run: true, texto: linhas.join("\n") });
      const enviado = await sendWhatsApp(supabase, linhas.join("\n"));
      return json({ ok: true, enviado, feitos, abertas });
    }

    return json({ ok: true, dia: hoje, grupos_ok: gruposOk, usuario: eu ? { id: eu.id, nome: eu.name, role: eu.role } : null, blocos,
      staff: undefined });
  } catch (e) {
    console.error("[produto-checkup] erro:", e);
    return json({ ok: false, erro: String((e as Error)?.message || e).slice(0, 300) }, 500);
  }
});
