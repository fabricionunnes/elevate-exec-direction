// threedcure-agendor-painel: monta funil de atendimentos e clientes/LTV da 3D Cure a partir do
// Agendor (CRM onde o time registra os negócios) e grava nas tabelas do Painel de KPIs
// (kpi_funil_*, kpi_clientes_*). 14/10/2026, Fabrício: "já pode colocar tudo no painel com o que
// você já tem", enquanto o sistema da 3D Cure não publica os recursos funil/clientes.
// Entrada: { modo?: "descobrir" | "carga" | "incremental", pagina_de?, paginas?, max_paginas? }
//   descobrir:   só estrutura (funis, etapas, nomes de campo, volumes), nada de dado de cliente.
//   carga:       copia as páginas pagina_de .. pagina_de+paginas-1 (histórico, rodar em blocos).
//   incremental: (padrão, cron) copia o que mudou desde a última cópia e consolida o painel.
// Guarda só o resumo do negócio: funil, etapa, situação, dono, valor, datas e o CÓDIGO do cliente
// no Agendor (nunca nome, e-mail ou telefone).
// Autenticação: header x-sync-secret = THREEDCURE_FUNIL_SECRET, ou Bearer da service role.
import { createClient } from "npm:@supabase/supabase-js@2";

const COMPANY_ID = "6e94acf4-4888-4c1c-bacd-0861ced43a87"; // 3D CURE
const AG = "https://api.agendor.com.br/v3";
type J = Record<string, any>;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

async function ag(path: string) {
  const token = Deno.env.get("AGENDOR_TOKEN_3DCURE");
  if (!token) throw new Error("AGENDOR_TOKEN_3DCURE ausente");
  for (let t = 0; t < 4; t++) {
    const r = await fetch(`${AG}${path}`, { headers: { Authorization: `Token ${token}` } });
    if (r.status === 429) { await new Promise((ok) => setTimeout(ok, 1500 * (t + 1))); continue; }
    if (!r.ok) throw new Error(`Agendor ${r.status} em ${path.split("?")[0]}: ${(await r.text()).slice(0, 150)}`);
    return await r.json();
  }
  throw new Error("Agendor: limite de requisições");
}

/** todos os negócios (todas as situações), página a página */
async function todosNegocios(maxPag = 300) {
  const out: J[] = [];
  for (let p = 1; p <= maxPag; p++) {
    const j = await ag(`/deals?per_page=100&page=${p}`);
    const d = j.data ?? [];
    out.push(...d);
    if (d.length < 100) break;
  }
  return out;
}

/** casa o dono do Agendor com o cadastro: todos os tokens do nome curto dentro do nome longo */
const norm = (s: string) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 1);
function casador(pessoas: { id: string; name: string }[]) {
  const cad = pessoas.map((p) => ({ id: p.id, t: norm(p.name) }));
  return (nome: string): string | null => {
    const t = norm(nome);
    if (!t.length) return null;
    const hits = cad.filter((c) => c.t.length && (t.every((x) => c.t.includes(x)) || c.t.every((x) => t.includes(x))));
    if (hits.length === 1) return hits[0].id;
    const pu = cad.filter((c) => c.t[0] === t[0] && c.t[c.t.length - 1] === t[t.length - 1]);
    return pu.length === 1 ? pu[0].id : null;
  };
}

/** estrutura de um objeto: nomes de campo e tipos, sem valores */
const forma = (v: unknown, d = 0): unknown => {
  if (Array.isArray(v)) return v.length ? [forma(v[0], d + 1)] : [];
  if (v && typeof v === "object") return d > 3 ? "{…}" : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, forma(x, d + 1)]));
  return v === null ? "null" : typeof v;
};

Deno.serve(async (req) => {
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const segredo = Deno.env.get("THREEDCURE_FUNIL_SECRET");
  if (!((segredo && req.headers.get("x-sync-secret") === segredo) || req.headers.get("authorization") === `Bearer ${service}`)) return json({ ok: false, error: "não autorizado" }, 401);
  try {
    const body: J = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const modo = body.modo ?? "incremental";
    const funis = await ag("/funnels");
    if (modo === "descobrir") {
      const negocios = await todosNegocios(body.max_paginas ?? 300);
      const porStatus: J = {}, porFunil: J = {}, porAno: J = {};
      let comOrg = 0, comPessoa = 0;
      for (const d of negocios) {
        const st = d.dealStatus?.name ?? d.dealStatus?.id ?? "?"; porStatus[st] = (porStatus[st] ?? 0) + 1;
        const fu = d.dealStage?.funnel?.name ?? d.dealStage?.funnel?.id ?? "?"; porFunil[fu] = (porFunil[fu] ?? 0) + 1;
        const a = String(d.createdAt ?? "").slice(0, 4); porAno[a] = (porAno[a] ?? 0) + 1;
        if (d.organization?.id) comOrg++; if (d.person?.id) comPessoa++;
      }
      return json({
        ok: true, modo,
        funis: (funis.data ?? []).map((f: J) => ({ id: f.id, nome: f.name, etapas: (f.dealStages ?? []).map((s: J) => ({ id: s.id, nome: s.name, seq: s.sequence })) })),
        negocios: negocios.length, por_status: porStatus, por_funil: porFunil, criados_por_ano: porAno,
        com_empresa: comOrg, com_pessoa: comPessoa,
        campos_do_negocio: forma(negocios[0] ?? {}),
        donos: [...new Set(negocios.map((d) => d.owner?.name).filter(Boolean))],
      });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, service, { auth: { persistSession: false } });
    const { data: pessoas } = await sb.from("company_salespeople").select("id,name").eq("company_id", COMPANY_ID);
    const casa = casador(pessoas ?? []);
    // por funil: sequência da 1ª etapa e da etapa de negociação
    const regra = new Map<number, { min: number; neg: number | null }>();
    for (const f of funis.data ?? []) {
      const st = (f.dealStages ?? []) as J[];
      const neg = st.filter((x) => /negocia/i.test(x.name ?? "")).map((x) => Number(x.sequence)).sort((a, b) => a - b)[0] ?? null;
      regra.set(Number(f.id), { min: Math.min(...st.map((x) => Number(x.sequence))), neg });
    }
    const resumo = (d: J) => {
      const seq = Number(d.dealStage?.sequence ?? 0), nomeEt = String(d.dealStage?.name ?? "");
      const r = regra.get(Number(d.dealStage?.funnel?.id)) ?? { min: 1, neg: null };
      const st = Number(d.dealStatus?.id ?? 1);
      const perca = /perca|perda/i.test(nomeEt);
      const dataBR = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10) : null);
      return {
        company_id: COMPANY_ID, id: Number(d.id),
        funil: d.dealStage?.funnel?.name ?? null, etapa: nomeEt || null, etapa_seq: seq || null,
        status: st,
        atendido: st === 2 || (!perca && seq > r.min) || (st === 3 && seq > r.min),
        negociou: st === 2 || (!perca && r.neg != null && seq >= r.neg),
        dono: d.owner?.name ?? null, salesperson_id: d.owner?.name ? casa(d.owner.name) : null,
        cliente: d.organization?.id ? `o:${d.organization.id}` : d.person?.id ? `p:${d.person.id}` : null,
        valor: Number(d.value) || 0,
        criado_em: d.createdAt ?? null,
        // venda conta na data de fechamento (endTime, data pura) como no agendor-sync; sem ela, data do ganho
        ganho_em: st === 2 ? (d.endTime ? String(d.endTime).slice(0, 10) : dataBR(d.wonAt ?? d.updatedAt)) : null,
        perdido_em: st === 3 ? dataBR(d.lostAt ?? d.updatedAt) : null,
        motivo_perda: d.lossReason?.name ?? null,
        atualizado_em: d.updatedAt ?? null,
      };
    };
    const gravar = async (lista: J[]) => {
      for (let i = 0; i < lista.length; i += 500) {
        const { error } = await sb.from("agendor_negocios").upsert(lista.slice(i, i + 500).map(resumo), { onConflict: "company_id,id" });
        if (error) throw new Error(`agendor_negocios: ${error.message}`);
      }
    };

    if (modo === "carga") {
      const de = Math.max(1, Number(body.pagina_de) || 1), n = Math.min(120, Number(body.paginas) || 60);
      let lidos = 0, ultima = de - 1, fim = false, ordemDesc = true, anterior: string | null = null;
      for (let p = de; p < de + n; p++) {
        const d = (await ag(`/deals?per_page=100&page=${p}`)).data ?? [];
        for (const x of d) { if (anterior && x.updatedAt > anterior) ordemDesc = false; anterior = x.updatedAt; }
        await gravar(d); lidos += d.length; ultima = p;
        if (d.length < 100) { fim = true; break; }
      }
      const cons = fim ? (await sb.rpc("agendor_consolidar_painel", { p_company: COMPANY_ID })).data : null;
      return json({ ok: true, modo, lidos, ultima_pagina: ultima, acabou: fim, ordem_por_atualizacao_desc: ordemDesc, consolidado: cons });
    }

    // incremental: a lista vem da atualização mais nova pra mais velha; para quando a página inteira é anterior ao corte
    const { data: ult } = await sb.from("agendor_negocios").select("atualizado_em").eq("company_id", COMPANY_ID).order("atualizado_em", { ascending: false }).limit(1);
    const corte = ult?.[0]?.atualizado_em ? new Date(new Date(ult[0].atualizado_em).getTime() - 2 * 3600000).toISOString() : null;
    if (!corte) return json({ ok: false, error: "rode a carga do histórico antes (modo carga)" }, 400);
    let lidos = 0, paginas = 0;
    for (let p = 1; p <= (body.max_paginas ?? 40); p++) {
      const d = (await ag(`/deals?per_page=100&page=${p}`)).data ?? [];
      const novos = d.filter((x: J) => (x.updatedAt ?? "") >= corte);
      await gravar(novos); lidos += novos.length; paginas = p;
      if (!novos.length || d.length < 100) break;
    }
    const { data: cons, error: ec } = await sb.rpc("agendor_consolidar_painel", { p_company: COMPANY_ID });
    if (ec) throw new Error(`consolidar: ${ec.message}`);
    return json({ ok: true, modo: "incremental", corte, paginas, atualizados: lidos, consolidado: cons });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
