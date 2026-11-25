// Funil de mini-eventos (25/11/2026): ingresso de R$ 97 pago direto no site pelo Asaas.
// Páginas: unvholdings.com.br/evento (venda), /evento/checkout e /evento/obrigado.
//
// Caminho do cliente (Fabrício, 25/11/2026: "melhor criar uma página nova, melhor que o nativo"):
// anúncio → /evento/inscricao (formulário nosso, lead criado na hora) → /evento (venda) → /evento/checkout → /evento/obrigado
// Pagamento: Pix pelo Asaas da UNV; cartão pelo Mercado Pago da Yasmim ("o pagamento no cartão é pra usar a conta da Yasmim").
//
// action=turma     dados públicos da turma (data, local, preço; vagas restantes só com menos de 10 sobrando)
// action=lead      formulário da página de captura: cria/atualiza o lead em "Novo lead" (1º passo: contato; 2º: respostas)
// action=visita    registra a visita à captura ou à página de venda (uma por sessão e por tipo), ligada ao lead quando há
// action=checkout  cria/atualiza o lead, gera o Pix no Asaas e o link de cartão no Mercado Pago da Yasmim,
//                  e leva o lead pra "Checkout iniciado"
// action=status    confere as duas cobranças; pago → inscrição paga, lead em "Ingresso pago", etiqueta e aviso no WhatsApp
// action=conferir  cron (mini-evento-conferir, a cada 5 min): confere os checkouts abertos dos últimos 3 dias e manda
//                  a primeira mensagem de WhatsApp pra quem preencheu o formulário e ainda não pagou
//
// WhatsApp (Fabrício, 25/11/2026: "usa a instância Fabrício Nunnes"): número comum, texto livre, sem modelo do Meta.
// Como é o número de uso dele, quem já tem conversa recente ali NÃO recebe mensagem automática: fica na fila do
// painel pra abordagem manual. O agente "Mini-eventos - Time do Fabrício" é fixado na conversa nova.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PIPELINE = "e1e00000-0000-4000-8000-000000000001";
const etapa = (n: number) => `e1e00000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;
const ETAPA = { novo: etapa(0), abordado: etapa(1), checkout: etapa(2), pago: etapa(3), naoComprou: etapa(9), perdido: etapa(11), foraPerfil: etapa(12) };
/** Etapas de onde o lead pode ser puxado pra "Checkout iniciado" / "Ingresso pago" (nunca volta quem já passou). */
const ANTES_DO_CHECKOUT = new Set([ETAPA.novo, ETAPA.abordado, ETAPA.naoComprou, ETAPA.perdido, ETAPA.foraPerfil]);
const ANTES_DO_PAGO = new Set([...ANTES_DO_CHECKOUT, ETAPA.checkout]);
const ORIGEM = "e1e00000-0000-4000-8000-000000000002";
const TAG_TURMA = "e1e00000-0000-4000-8000-000000000031";
const TAG_PAGO = "e1e00000-0000-4000-8000-000000000032";
const TAG_SOCIO = "e1e00000-0000-4000-8000-000000000033";
const DONO_FABRICIO = "b1a918b1-8776-4962-898e-5d97c7cc80c1";
const INSTANCIA_AVISO = "fabricionunnes";
const INSTANCIA_LEADS = "fabricionunnes";        // de onde sai a mensagem pro lead
const AGENTE = "e1e00000-0000-4000-8000-000000000009";
const ESPERA_MIN = 3;                            // minutos depois do formulário (com o cron de 5 min, sai entre 3 e 8)
const CONVERSA_RECENTE_DIAS = 45;                // conversa com mensagem nesse prazo = contato dele, não automatiza
const MAX_POR_RODADA = 8;
const AVISO_PARA = "5531989840003";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type SB = any;
const so = (v: unknown, max = 160) => String(v ?? "").trim().slice(0, max);
const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const quando = () => new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const ymdBR = (ms: number) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10);
const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function chaveTel(v: unknown): string | null {
  let d = digitos(v);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 10) return null;
  return d.slice(0, 2) + d.slice(-8);
}
function cpfOk(c: string) {
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const n of [9, 10]) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(c[n])) return false;
  }
  return true;
}
function cnpjOk(c: string) {
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n: number) => {
    const p = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = p.reduce((a, w, i) => a + Number(c[i]) * w, 0) % 11;
    return s < 2 ? 0 : 11 - s;
  };
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
}

const ASAAS = "https://api.asaas.com/v3";
async function asaas(path: string, method = "GET", body?: unknown) {
  const r = await fetch(`${ASAAS}${path}`, {
    method, headers: { "Content-Type": "application/json", access_token: Deno.env.get("ASAAS_API_KEY") || "" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.errors?.[0]?.description || `Asaas HTTP ${r.status}`);
  return d;
}

// Mercado Pago da Yasmim (o segredo foi salvo como MERCADOPAGOYAS no painel; aceita os dois nomes)
const MP_YAS = () => Deno.env.get("MERCADOPAGO_YAS_ACCESS_TOKEN") || Deno.env.get("MERCADOPAGOYAS") || "";
async function mp(path: string, method = "GET", body?: unknown) {
  const r = await fetch(`https://api.mercadopago.com${path}`, {
    method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${MP_YAS()}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.message || `Mercado Pago HTTP ${r.status}`);
  return d;
}
const SITE = "https://unvholdings.com.br";
const uuidOk = (v: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(String(v || ""));

const FAIXAS: Record<string, { rotulo: string; min: number }> = {
  ate_50: { rotulo: "Até R$ 50 mil", min: 0 },
  "50_150": { rotulo: "R$ 50 mil a R$ 150 mil", min: 50000 },
  "150_500": { rotulo: "R$ 150 mil a R$ 500 mil", min: 150000 },
  "500_mais": { rotulo: "Acima de R$ 500 mil", min: 500000 },
};
const VENDEDORES: Record<string, string> = { so_eu: "Só eu", "1_3": "1 a 3", "4_10": "4 a 10", "10_mais": "Mais de 10" };

/** O que veio na URL do anúncio (o lead guarda pra saber qual promessa e qual criativo trouxe a pessoa). */
/** O Meta manda o nome do anúncio codificado ("P01+PLANEJAMENTO+2027+%7C+VIDEO"); o painel casa pelo nome limpo. */
function limpo(v: unknown, max = 160) {
  let t = so(v, max * 3);
  if (/%[0-9A-Fa-f]{2}|\+/.test(t)) { try { t = decodeURIComponent(t.replace(/\+/g, " ")); } catch { t = t.replace(/\+/g, " "); } }
  return t.trim().slice(0, max);
}
/** Robô de revisão de anúncio e de prévia de link não conta como visita. */
const ROBO = /facebookexternalhit|facebot|meta-externalagent|bot\b|crawler|spider|headless|lighthouse|preview|whatsapp\//i;

function rastreio(body: Record<string, unknown>) {
  return {
    utm_source: so(body.utm_source, 80) || null, utm_medium: so(body.utm_medium, 80) || null, utm_campaign: limpo(body.utm_campaign) || null,
    utm_content: limpo(body.utm_content) || null, utm_term: limpo(body.utm_term) || null, fbclid: so(body.fbclid, 300) || null,
    meta_ad_id: /^\d{6,}$/.test(so(body.ad_id, 40)) ? so(body.ad_id, 40) : null,
    meta_adset_id: /^\d{6,}$/.test(so(body.adset_id, 40)) ? so(body.adset_id, 40) : null,
    meta_campaign_id: /^\d{6,}$/.test(so(body.campaign_id, 40)) ? so(body.campaign_id, 40) : null,
  };
}

async function turmaPorSlug(sb: SB, slug: unknown) {
  const s = so(slug, 60);
  const q = sb.from("miniev_turmas").select("*").eq("ativa", true);
  const { data } = s ? await q.eq("slug", s).maybeSingle() : await q.order("data_evento", { ascending: true }).limit(1).maybeSingle();
  return data;
}
async function pagos(sb: SB, turmaId: string) {
  const { count } = await sb.from("miniev_inscricoes").select("id", { count: "exact", head: true }).eq("turma_id", turmaId).eq("status", "pago");
  return count || 0;
}
/** Vagas restantes só aparecem quando sobram menos de 10 (Fabrício, 25/11/2026). Antes disso o número nem sai daqui. */
const MOSTRA_RESTANTES_ABAIXO_DE = 10;
function publica(t: any, nPagos: number) {
  const sobra = Math.max(0, t.vagas - nPagos);
  const aberta = !t.venda_ate || new Date(t.venda_ate).getTime() > Date.now();
  return {
    slug: t.slug, nome: t.nome, promessa: t.promessa, data_evento: t.data_evento, horario: t.horario, cidade: t.cidade,
    local_nome: t.local_nome, preco_cents: t.preco_cents, preco_socio_cents: t.preco_socio_cents, vagas: t.vagas,
    restantes: sobra < MOSTRA_RESTANTES_ABAIXO_DE ? sobra : null, esgotado: sobra <= 0, venda_ate: t.venda_ate, aberta: aberta && nPagos < t.vagas,
  };
}

async function turma(sb: SB, body: Record<string, unknown>) {
  const t = await turmaPorSlug(sb, body.slug);
  if (!t) return json({ error: "turma_nao_encontrada" }, 404);
  return json({ turma: publica(t, await pagos(sb, t.id)) });
}

async function visita(sb: SB, body: Record<string, unknown>, agente: string) {
  if (!agente || ROBO.test(agente)) return json({ ok: true });
  const t = await turmaPorSlug(sb, body.slug);
  if (!t) return json({ ok: false });
  const sessao = so(body.sessao, 60);
  if (!sessao) return json({ ok: false });
  const tipo = body.tipo === "captura_vista" ? "captura_vista" : "pagina_vista";
  const leadId = uuidOk(body.lead_id) ? String(body.lead_id) : null;
  const { data: ja } = await sb.from("miniev_eventos").select("id, lead_id").eq("turma_id", t.id).eq("tipo", tipo).eq("sessao", sessao).limit(1);
  if (!ja?.length) {
    await sb.from("miniev_eventos").insert({
      turma_id: t.id, tipo, sessao, lead_id: leadId,
      dados: { utm_source: so(body.utm_source, 80) || null, utm_content: limpo(body.utm_content) || null, p: so(body.p, 4) || null, origem: so(body.origem, 40) || null },
    });
  } else if (leadId && !ja[0].lead_id) {
    await sb.from("miniev_eventos").update({ lead_id: leadId }).eq("id", ja[0].id);
  }
  return json({ ok: true });
}

/** Lead do funil Mini-eventos com o mesmo telefone (o lead do formulário do Meta já está lá) ou o mesmo e-mail. */
async function acharLead(sb: SB, k: string, email?: string) {
  const ors = [`phone.ilike.*${k.slice(-8)}`];
  if (email) ors.push(`email.eq.${email}`);
  const { data } = await sb.from("crm_leads").select("id, phone, email, stage_id, notes, owner_staff_id")
    .eq("pipeline_id", PIPELINE).or(ors.join(",")).order("created_at", { ascending: false }).limit(10);
  const c = data || [];
  return c.find((l: any) => chaveTel(l.phone) === k) || (email ? c.find((l: any) => String(l.email || "").toLowerCase() === email) : null) || null;
}

/** Formulário da página de captura. 1º passo: nome, WhatsApp e e-mail (o lead já nasce aqui). 2º passo: as três respostas. */
async function lead(sb: SB, body: Record<string, unknown>) {
  const t = await turmaPorSlug(sb, body.slug);
  if (!t) return json({ error: "turma_nao_encontrada" }, 404);
  const a = { nome: so(body.nome, 120), telefone: digitos(body.telefone), email: so(body.email, 160).toLowerCase(), desafio: so(body.desafio, 800) };
  if (a.nome.length < 2) return json({ error: "nome" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.email)) return json({ error: "email_invalido" }, 400);
  const k = chaveTel(a.telefone);
  if (!k) return json({ error: "telefone_invalido" }, 400);
  const faixa = FAIXAS[so(body.faturamento, 20)], vend = VENDEDORES[so(body.vendedores, 20)];
  const phone = a.telefone.replace(/^55(?=\d{10,11}$)/, "");
  const r = rastreio(body);
  const p = so(body.p, 4);
  const respostas = faixa || vend || a.desafio
    ? [`RESPOSTAS DO FORMULÁRIO (${quando()})`, faixa ? `Faturamento mensal: ${faixa.rotulo}` : "", vend ? `Vendedores: ${vend}` : "", a.desafio ? `Maior desafio comercial: ${a.desafio}` : ""].filter(Boolean).join("\n")
    : "";
  let l = await acharLead(sb, k, a.email);
  let novo = false;
  if (!l) {
    const nota = [`INSCRIÇÃO NO MINI-EVENTO pelo site (${quando()}) · ${t.nome}${p ? ` · promessa ${p}` : ""}`, respostas].filter(Boolean).join("\n\n");
    const { data: criado, error } = await sb.from("crm_leads").insert({
      name: a.nome, phone, email: a.email, pipeline_id: PIPELINE, stage_id: ETAPA.novo, origin_id: ORIGEM, origin: "Site /evento/inscricao",
      opportunity_value: t.preco_cents / 100, entered_pipeline_at: new Date().toISOString(), notes: nota,
      main_pain: a.desafio || null, estimated_revenue: faixa?.min || null,
      utm_source: r.utm_source || "site", utm_medium: r.utm_medium, utm_campaign: r.utm_campaign || "mini-evento", utm_content: r.utm_content, utm_term: r.utm_term,
      fbclid: r.fbclid, ad_name: r.utm_content, adset_name: r.utm_term, campaign_name: r.utm_campaign,
      meta_ad_id: r.meta_ad_id, meta_adset_id: r.meta_adset_id, meta_campaign_id: r.meta_campaign_id,
    }).select("id").single();
    if (error || !criado) { console.error("[mini-evento] lead", error); return json({ error: "falha_lead" }, 500); }
    l = criado; novo = true;
    await sb.from("crm_lead_tags").insert({ lead_id: l.id, tag_id: TAG_TURMA }).then((x: any) => { if (x.error) console.error("[mini-evento] tag", x.error); });
    await sb.from("miniev_eventos").insert({ turma_id: t.id, tipo: "lead_criado", lead_id: l.id, sessao: so(body.sessao, 60) || null, dados: { p: p || null, anuncio: r.utm_content } });
  } else if (respostas || a.nome) {
    const upd: Record<string, unknown> = { name: a.nome, email: a.email };
    if (respostas) upd.notes = l.notes ? `${respostas}\n\n${l.notes}` : respostas;
    if (a.desafio) upd.main_pain = a.desafio;
    if (faixa) upd.estimated_revenue = faixa.min || null;
    const { error } = await sb.from("crm_leads").update(upd).eq("id", l.id);
    if (error) console.error("[mini-evento] lead upd", error);
  }
  return json({ lead_id: l.id, novo });
}

async function checkout(sb: SB, body: Record<string, unknown>) {
  const t = await turmaPorSlug(sb, body.slug);
  if (!t) return json({ error: "turma_nao_encontrada" }, 404);
  const a = {
    nome: so(body.nome, 120), telefone: digitos(body.telefone), email: so(body.email, 160).toLowerCase(),
    documento: digitos(body.documento), com_socio: body.com_socio === true, socio_nome: so(body.socio_nome, 120),
  };
  if (a.nome.split(/\s+/).length < 2) return json({ error: "nome_completo" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.email)) return json({ error: "email_invalido" }, 400);
  const k = chaveTel(a.telefone);
  if (!k) return json({ error: "telefone_invalido" }, 400);
  if (!(cpfOk(a.documento) || cnpjOk(a.documento))) return json({ error: "documento_invalido" }, 400);
  if (a.com_socio && a.socio_nome.length < 2) return json({ error: "socio_nome" }, 400);

  const nPagos = await pagos(sb, t.id);
  const pub = publica(t, nPagos);
  if (!pub.aberta) return json({ error: nPagos >= t.vagas ? "esgotado" : "encerrado" }, 409);

  const phone = a.telefone.replace(/^55(?=\d{10,11}$)/, "");
  const valor = t.preco_cents + (a.com_socio ? t.preco_socio_cents : 0);

  // Já pagou com este telefone? Devolve a inscrição paga (não cobra duas vezes).
  const { data: minhas } = await sb.from("miniev_inscricoes").select("*").eq("turma_id", t.id).ilike("telefone", `%${k.slice(-8)}`)
    .order("criado_em", { ascending: false }).limit(5);
  const paga = (minhas || []).find((i: any) => i.status === "pago" && chaveTel(i.telefone) === k);
  if (paga) return json({ id: paga.id, status: "pago" });
  // Checkout aberto do mesmo valor nas últimas 20 horas: reaproveita a mesma cobrança
  const aberta = (minhas || []).find((i: any) => i.status === "checkout" && chaveTel(i.telefone) === k && i.valor_cents === valor && i.asaas_payment_id
    && Date.now() - new Date(i.criado_em).getTime() < 20 * 3600000);
  if (aberta) return json({ id: aberta.id, status: "checkout", valor_cents: valor, pix_payload: aberta.pix_payload, pix_image: aberta.pix_image, cartao_url: aberta.cartao_url });

  const utm = rastreio(body);
  const nota = `CHECKOUT DO INGRESSO (${quando()}) · ${t.nome} · ${brl(valor)}${a.com_socio ? ` · com sócio: ${a.socio_nome}` : ""}`;
  let lead = await acharLead(sb, k, a.email);
  if (!lead && uuidOk(body.lead_id)) {
    const { data: conhecido } = await sb.from("crm_leads").select("id, phone, email, stage_id, notes, owner_staff_id").eq("id", body.lead_id).eq("pipeline_id", PIPELINE).maybeSingle();
    if (conhecido) lead = conhecido;
  }
  if (!lead) {
    const { data: novo, error } = await sb.from("crm_leads").insert({
      name: a.nome, phone, email: a.email, document: a.documento, pipeline_id: PIPELINE, stage_id: ETAPA.checkout,
      origin_id: ORIGEM, origin: "Site /evento", owner_staff_id: DONO_FABRICIO, opportunity_value: valor / 100,
      entered_pipeline_at: new Date().toISOString(), notes: nota, has_partner: a.com_socio || null,
      utm_source: utm.utm_source || "site", utm_medium: utm.utm_medium, utm_campaign: utm.utm_campaign || "mini-evento",
      utm_content: utm.utm_content, utm_term: utm.utm_term, fbclid: utm.fbclid, ad_name: utm.utm_content, adset_name: utm.utm_term,
      campaign_name: utm.utm_campaign, meta_ad_id: utm.meta_ad_id, meta_adset_id: utm.meta_adset_id, meta_campaign_id: utm.meta_campaign_id,
    }).select("id").single();
    if (error || !novo) { console.error("[mini-evento] lead", error); return json({ error: "falha_lead" }, 500); }
    lead = novo;
  } else {
    const upd: Record<string, unknown> = { email: a.email, document: a.documento, notes: lead.notes ? `${nota}\n\n${lead.notes}` : nota };
    if (ANTES_DO_CHECKOUT.has(lead.stage_id)) Object.assign(upd, { stage_id: ETAPA.checkout, closed_at: null, loss_reason_id: null });
    const { error } = await sb.from("crm_leads").update(upd).eq("id", lead.id);
    if (error) console.error("[mini-evento] lead upd", error);
  }

  const { data: insc, error: ie } = await sb.from("miniev_inscricoes").insert({
    turma_id: t.id, lead_id: lead.id, nome: a.nome, telefone: phone, email: a.email, documento: a.documento,
    com_socio: a.com_socio, socio_nome: a.com_socio ? a.socio_nome : null, valor_cents: valor, utm,
  }).select("id").single();
  if (ie || !insc) { console.error("[mini-evento] inscricao", ie); return json({ error: "falha_inscricao" }, 500); }

  try {
    const achou = await asaas(`/customers?cpfCnpj=${a.documento}&limit=1`);
    const cliente = achou?.data?.[0] || await asaas("/customers", "POST", {
      name: a.nome, cpfCnpj: a.documento, email: a.email, mobilePhone: phone, notificationDisabled: true, externalReference: `lead:${lead.id}`,
    });
    const [ano, mes, dia] = String(t.data_evento).split("-");
    // Vence amanhã; nunca depois do dia do evento
    const venc = [ymdBR(Date.now() + 86400000), String(t.data_evento)].sort()[0];
    const pay = await asaas("/payments", "POST", {
      customer: cliente.id, billingType: "PIX", value: valor / 100, dueDate: venc,
      description: `Ingresso · Workshop presencial com Fabrício Nunnes · ${t.cidade} · ${dia}/${mes}/${ano}${a.com_socio ? " · 2 pessoas" : ""}`,
      externalReference: `miniev:${insc.id}`,
    });
    let qr: any = null;
    try { qr = await asaas(`/payments/${pay.id}/pixQrCode`); } catch (e) { console.error("[mini-evento] qr", e); }
    // Cartão: Mercado Pago da Yasmim (só cartão; a conferência é pela referência miniev:<id>)
    let cartao: any = null;
    if (MP_YAS()) {
      try {
        const volta = `${SITE}/evento/obrigado/?i=${insc.id}&t=${encodeURIComponent(t.slug)}`;
        cartao = await mp("/checkout/preferences", "POST", {
          items: [{ title: `Ingresso · Workshop presencial com Fabrício Nunnes · ${dia}/${mes}${a.com_socio ? " · 2 pessoas" : ""}`, quantity: 1, unit_price: valor / 100, currency_id: "BRL" }],
          payer: { name: a.nome, email: a.email },
          external_reference: `miniev:${insc.id}`,
          back_urls: { success: volta, pending: volta, failure: `${SITE}/evento/checkout/?t=${encodeURIComponent(t.slug)}` },
          auto_return: "approved",
          payment_methods: { installments: 3, excluded_payment_types: [{ id: "ticket" }, { id: "bank_transfer" }, { id: "atm" }] },
          statement_descriptor: "WORKSHOP UNV",
        });
      } catch (e) { console.error("[mini-evento] cartão (Mercado Pago Yas)", e); }
    } else console.error("[mini-evento] sem token do Mercado Pago Yas: checkout só com Pix");
    const cartaoUrl = cartao?.init_point || null;
    await sb.from("miniev_inscricoes").update({
      asaas_customer_id: cliente.id, asaas_payment_id: pay.id, invoice_url: pay.invoiceUrl,
      pix_payload: qr?.payload || null, pix_image: qr?.encodedImage || null,
      mp_preference_id: cartao?.id || null, cartao_url: cartaoUrl,
    }).eq("id", insc.id);
    await sb.from("miniev_eventos").insert({ turma_id: t.id, tipo: "checkout_iniciado", lead_id: lead.id, inscricao_id: insc.id, dados: { valor: valor / 100, com_socio: a.com_socio } });
    return json({ id: insc.id, status: "checkout", valor_cents: valor, pix_payload: qr?.payload || null, pix_image: qr?.encodedImage || null, cartao_url: cartaoUrl });
  } catch (e) {
    console.error("[mini-evento] asaas", e);
    await sb.from("miniev_inscricoes").update({ status: "cancelado" }).eq("id", insc.id);
    return json({ error: "falha_cobranca", detalhe: String((e as Error).message || e).slice(0, 200) }, 502);
  }
}

/** Confere a cobrança no Asaas. Pago: marca a inscrição (uma vez só), anda o lead, etiqueta e avisa. */
async function conferir(sb: SB, i: any): Promise<string> {
  if (i.status === "pago") return "pago";
  if (!i.asaas_payment_id && !i.mp_preference_id) return i.status;
  // p = como foi pago: Pix (Asaas da UNV) ou cartão (Mercado Pago da Yasmim)
  let p: { billingType: string; ref: string; provider: string } | null = null;
  if (i.asaas_payment_id) {
    const a = await asaas(`/payments/${i.asaas_payment_id}`);
    if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(a.status)) p = { billingType: "PIX", ref: i.asaas_payment_id, provider: "asaas" };
  }
  if (!p && i.mp_preference_id && MP_YAS()) {
    try {
      const b = await mp(`/v1/payments/search?external_reference=${encodeURIComponent(`miniev:${i.id}`)}&sort=date_created&criteria=desc&limit=10`);
      const ok = (b?.results || []).find((x: any) => x.status === "approved");
      if (ok) p = { billingType: "CREDIT_CARD", ref: String(ok.id), provider: "mercadopago_yas" };
    } catch (e) { console.error("[mini-evento] conferir cartão", e); }
  }
  if (!p) return "checkout";
  const { data: trava } = await sb.from("miniev_inscricoes").update({ status: "pago", pago_em: new Date().toISOString() })
    .eq("id", i.id).eq("status", "checkout").select("id");
  if (!trava?.length) return "pago";
  await sb.from("miniev_eventos").insert({ turma_id: i.turma_id, tipo: "ingresso_pago", lead_id: i.lead_id, inscricao_id: i.id, dados: { valor: i.valor_cents / 100, forma: p.billingType } });
  if (i.lead_id) {
    const { data: l } = await sb.from("crm_leads").select("stage_id, notes").eq("id", i.lead_id).maybeSingle();
    const nota = `INGRESSO PAGO (${quando()}) · ${brl(i.valor_cents)} · ${p.billingType === "CREDIT_CARD" ? "cartão" : "Pix"}${i.com_socio ? ` · com sócio: ${i.socio_nome}` : ""}`;
    const upd: Record<string, unknown> = { notes: l?.notes ? `${nota}\n\n${l.notes}` : nota };
    if (l && ANTES_DO_PAGO.has(l.stage_id)) Object.assign(upd, { stage_id: ETAPA.pago, closed_at: null, loss_reason_id: null });
    await sb.from("crm_leads").update(upd).eq("id", i.lead_id);
    for (const tag of [TAG_PAGO, ...(i.com_socio ? [TAG_SOCIO] : [])]) {
      const { data: tem } = await sb.from("crm_lead_tags").select("id").eq("lead_id", i.lead_id).eq("tag_id", tag).maybeSingle();
      if (!tem) await sb.from("crm_lead_tags").insert({ lead_id: i.lead_id, tag_id: tag });
    }
    await sb.from("crm_lead_payments").insert({
      lead_id: i.lead_id, amount_cents: i.valor_cents, description: "Ingresso do mini-evento", provider: p.provider, provider_ref: p.ref,
      url: p.provider === "asaas" ? i.invoice_url : i.cartao_url, status: "paid", payer_email: i.email, paid_at: new Date().toISOString(), billing_type: p.billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX",
    }).then((r: any) => { if (r.error) console.error("[mini-evento] lead_payment", r.error); });
  }
  // confirmação pro próprio lead, pelo mesmo número
  try {
    const { data: tt } = await sb.from("miniev_turmas").select("data_evento, horario, cidade").eq("id", i.turma_id).maybeSingle();
    if (tt) {
      const [, mes, dia] = String(tt.data_evento).split("-");
      const semana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][new Date(`${tt.data_evento}T12:00:00-03:00`).getDay()];
      const nome = primeiroNome(i.nome);
      const texto = `Vaga confirmada${nome ? `, ${nome}` : ""}. ${semana}, ${dia}/${mes}, das ${tt.horario}, em ${tt.cidade}. O endereço, o mapa e o grupo da turma chegam por aqui antes do evento. Pra eu preparar seu material: se você pudesse resolver uma coisa só no seu comercial nesse dia, qual seria?`;
      const r = await mandarWhatsApp(sb, { leadId: i.lead_id, nome: i.nome, telefone: i.telefone, texto, soConversaNova: false });
      if (!r.ok) console.error("[mini-evento] confirmação não enviada:", r.motivo);
    }
  } catch (e) { console.error("[mini-evento] confirmação", e); }
  try {
    const { data: t } = await sb.from("miniev_turmas").select("nome, vagas").eq("id", i.turma_id).maybeSingle();
    const n = await pagos(sb, i.turma_id);
    const { data: inst } = await sb.from("whatsapp_instances").select("instance_name, api_url, api_key").eq("instance_name", INSTANCIA_AVISO).maybeSingle();
    if (inst?.api_url) {
      const texto = `*INGRESSO PAGO*\n\n${i.nome}${i.com_socio ? ` + sócio (${i.socio_nome})` : ""}\n${i.telefone}\n${brl(i.valor_cents)} · ${p.provider === "asaas" ? "Pix (Asaas)" : "cartão (Mercado Pago Yas)"}\n\n${t?.nome || "Mini-evento"}: ${n} de ${t?.vagas || 25} vagas`;
      await fetch(`${String(inst.api_url).replace(/\/+$/, "")}/message/sendText/${inst.instance_name}`, {
        method: "POST", headers: { apikey: inst.api_key, "Content-Type": "application/json" },
        body: JSON.stringify({ number: AVISO_PARA, text: texto }),
      });
      await sb.from("miniev_inscricoes").update({ avisado_em: new Date().toISOString() }).eq("id", i.id);
    }
  } catch (e) { console.error("[mini-evento] aviso", e); }
  return "pago";
}

// ── WhatsApp pelo número comum ──────────────────────────────────────────────
const horaBR = () => Number(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false })) % 24;
const primeiroNome = (n: unknown) => { const p = String(n || "").trim().split(/\s+/)[0] || ""; return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ""; };
function variantesBR(d: string): string[] {
  const out = new Set<string>([d]);
  if (d.startsWith("55") && d.length === 13 && d[4] === "9") out.add(d.slice(0, 4) + d.slice(5));
  if (d.startsWith("55") && d.length === 12) out.add(d.slice(0, 4) + "9" + d.slice(4));
  return [...out];
}

/** Manda um texto pro lead pela instância Fabrício Nunnes e grava no Atendimento. Devolve o motivo quando não manda. */
async function mandarWhatsApp(sb: SB, a: { leadId: string | null; nome: string; telefone: string; texto: string; soConversaNova: boolean }): Promise<{ ok: boolean; motivo?: string; conversa?: string }> {
  const bruto = digitos(a.telefone);
  if (bruto.length < 10) return { ok: false, motivo: "telefone inválido" };
  const numero = bruto.startsWith("55") && bruto.length > 11 ? bruto : `55${bruto}`;
  const { data: inst } = await sb.from("whatsapp_instances").select("id, instance_name, api_url, api_key, status").eq("instance_name", INSTANCIA_LEADS).maybeSingle();
  if (!inst?.api_url || inst.status !== "connected") return { ok: false, motivo: "número Fabrício Nunnes desconectado" };
  const base = String(inst.api_url).replace(/\/+$/, "");
  // telefone como o WhatsApp conhece (muitos voltam sem o nono dígito)
  let jid = numero;
  try {
    const r = await fetch(`${base}/chat/whatsappNumbers/${inst.instance_name}`, { method: "POST", headers: { apikey: inst.api_key, "Content-Type": "application/json" }, body: JSON.stringify({ numbers: [numero] }) });
    const d = await r.json();
    const hit = Array.isArray(d) ? d[0] : null;
    if (hit && hit.exists === false) return { ok: false, motivo: "telefone sem WhatsApp" };
    const doJid = String(hit?.jid || "").split("@")[0].replace(/\D/g, "");
    if (doJid.length >= 10) jid = doJid;
  } catch (e) { console.error("[mini-evento] whatsappNumbers", e); }

  const variantes = [...new Set([jid, ...variantesBR(jid), ...variantesBR(numero)])];
  const { data: contatos } = await sb.from("crm_whatsapp_contacts").select("id, phone, lead_id").in("phone", variantes);
  let contato = (contatos || []).find((c: any) => c.phone === jid) || (contatos || [])[0] || null;
  const idsContato = (contatos || []).map((c: any) => c.id);
  let conversa: any = null;
  if (idsContato.length) {
    const { data: ex } = await sb.from("crm_whatsapp_conversations").select("id, lead_id, last_message_at, merged_into")
      .eq("instance_id", inst.id).in("contact_id", idsContato).is("merged_into", null)
      .order("last_message_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
    conversa = ex || null;
  }
  // Já conversa com o Fabrício por aqui? Não entra mensagem automática nem agente: fica pra abordagem manual.
  const recente = conversa?.last_message_at && Date.now() - new Date(conversa.last_message_at).getTime() < CONVERSA_RECENTE_DIAS * 86400000;
  if (a.soConversaNova && recente && conversa.lead_id !== a.leadId) return { ok: false, motivo: "já tem conversa recente com o Fabrício neste número" };

  if (!contato) {
    const { data: novo, error } = await sb.from("crm_whatsapp_contacts").insert({ phone: jid, name: a.nome || jid, lead_id: a.leadId }).select("id, phone, lead_id").single();
    if (error) return { ok: false, motivo: `contato: ${error.message}` };
    contato = novo;
  }
  let nova = false;
  if (!conversa) {
    const { data: criada, error } = await sb.from("crm_whatsapp_conversations")
      .insert({ instance_id: inst.id, contact_id: contato.id, lead_id: a.leadId, status: "open", unread_count: 0 }).select("id, lead_id, merged_into").single();
    if (error) return { ok: false, motivo: `conversa: ${error.message}` };
    conversa = criada; nova = true;
  } else if (a.leadId && !conversa.lead_id) {
    await sb.from("crm_whatsapp_conversations").update({ lead_id: a.leadId }).eq("id", conversa.id);
  }

  const r = await fetch(`${base}/message/sendText/${inst.instance_name}`, { method: "POST", headers: { apikey: inst.api_key, "Content-Type": "application/json" }, body: JSON.stringify({ number: jid, text: a.texto }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, motivo: `envio recusado (${r.status})` };
  const remoteId = d?.key?.id || null;
  await sb.from("crm_whatsapp_messages").insert({
    conversation_id: conversa.id, content: a.texto, type: "text", direction: "outbound", status: "sent",
    remote_id: remoteId, whatsapp_message_id: remoteId, is_ai: false, sent_by: null,
  }).then((x: any) => { if (x.error) console.error("[mini-evento] msg", x.error); });
  // conversa aberta por aqui: o agente dos mini-eventos fica fixado nela
  if (nova || conversa.lead_id === a.leadId) {
    const { data: tem } = await sb.from("crm_ai_agent_conversation_overrides").select("id").eq("conversation_id", conversa.id).limit(1);
    if (!tem?.length) {
      await sb.from("crm_ai_agent_conversation_overrides").insert({ agent_id: AGENTE, conversation_id: conversa.id, channel: "whatsapp", enabled: true, reply_mode: "auto", locked: true })
        .then((x: any) => { if (x.error) console.error("[mini-evento] agente na conversa", x.error); });
    }
  }
  return { ok: true, conversa: conversa.id };
}

/** Primeira mensagem: quem preencheu o formulário há alguns minutos, está em "Novo lead" ou "Checkout iniciado" e não pagou. */
async function abordarNovos(sb: SB) {
  const h = horaBR();
  if (h < 8 || h >= 21) return { enviados: 0, fora_do_horario: true };
  const { data: turmas } = await sb.from("miniev_turmas").select("id, nome, data_evento, cidade, venda_ate").eq("ativa", true);
  let enviados = 0, pulados = 0;
  for (const t of turmas || []) {
    if (t.venda_ate && new Date(t.venda_ate).getTime() < Date.now()) continue;
    // só quem entrou por esta turma: evento lead_criado dos últimos 3 dias, ainda sem abordagem registrada
    const { data: criados } = await sb.from("miniev_eventos").select("lead_id, em").eq("turma_id", t.id).eq("tipo", "lead_criado")
      .gte("em", new Date(Date.now() - 3 * 86400000).toISOString()).lte("em", new Date(Date.now() - ESPERA_MIN * 60000).toISOString()).order("em").limit(200);
    const ids = [...new Set((criados || []).map((e: any) => e.lead_id).filter(Boolean))];
    if (!ids.length) continue;
    const { data: feitos } = await sb.from("miniev_eventos").select("lead_id").eq("turma_id", t.id).in("tipo", ["whatsapp_abordado", "whatsapp_pulado"]).in("lead_id", ids);
    const jaFoi = new Set((feitos || []).map((e: any) => e.lead_id));
    const { data: leads } = await sb.from("crm_leads").select("id, name, phone, stage_id").in("id", ids.filter((i) => !jaFoi.has(i))).in("stage_id", [ETAPA.novo, ETAPA.checkout]);
    const [, mes, dia] = String(t.data_evento).split("-");
    const semana = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][new Date(`${t.data_evento}T12:00:00-03:00`).getDay()];
    for (const l of (leads || []).slice(0, MAX_POR_RODADA - enviados)) {
      const { data: paga } = await sb.from("miniev_inscricoes").select("id").eq("turma_id", t.id).eq("lead_id", l.id).eq("status", "pago").limit(1);
      if (paga?.length) continue;
      const nome = primeiroNome(l.name);
      const texto = `${nome ? `${nome}, aqui` : "Aqui"} é do time do Fabrício Nunnes. Vi que você se inscreveu no workshop de ${semana}, dia ${dia}/${mes}, em ${t.cidade}, mas sua vaga ainda não está confirmada. Ficou alguma dúvida ou travou no pagamento?`;
      let r: { ok: boolean; motivo?: string; conversa?: string };
      try { r = await mandarWhatsApp(sb, { leadId: l.id, nome: l.name, telefone: l.phone, texto, soConversaNova: true }); }
      catch (e) { r = { ok: false, motivo: String((e as Error).message || e).slice(0, 120) }; }
      await sb.from("miniev_eventos").insert({ turma_id: t.id, tipo: r.ok ? "whatsapp_abordado" : "whatsapp_pulado", lead_id: l.id, dados: r.ok ? { conversa: r.conversa } : { motivo: r.motivo } });
      if (r.ok) {
        enviados++;
        if (l.stage_id === ETAPA.novo) await sb.from("crm_leads").update({ stage_id: ETAPA.abordado }).eq("id", l.id).eq("stage_id", ETAPA.novo);
        await new Promise((ok) => setTimeout(ok, 2500));
      } else pulados++;
      if (enviados >= MAX_POR_RODADA) break;
    }
  }
  return { enviados, pulados };
}

async function status(sb: SB, body: Record<string, unknown>) {
  const id = so(body.id, 40);
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: "id_invalido" }, 400);
  const { data: i } = await sb.from("miniev_inscricoes").select("*").eq("id", id).maybeSingle();
  if (!i) return json({ error: "nao_encontrada" }, 404);
  const st = await conferir(sb, i);
  const { data: t } = await sb.from("miniev_turmas").select("*").eq("id", i.turma_id).maybeSingle();
  const resp: Record<string, unknown> = { status: st, valor_cents: i.valor_cents, primeiro_nome: String(i.nome || "").split(" ")[0] };
  // Endereço e grupo só pra quem pagou
  if (st === "pago" && t) Object.assign(resp, { local_nome: t.local_nome, endereco: t.endereco, mapa_url: t.mapa_url, grupo_whatsapp: t.grupo_whatsapp, data_evento: t.data_evento, horario: t.horario, cidade: t.cidade });
  return json(resp);
}

async function conferirPendentes(sb: SB) {
  const { data } = await sb.from("miniev_inscricoes").select("*").eq("status", "checkout")
    .gte("criado_em", new Date(Date.now() - 3 * 86400000).toISOString()).order("criado_em", { ascending: false }).limit(60);
  let n = 0;
  for (const i of data || []) {
    try { if (await conferir(sb, i) === "pago") n++; } catch (e) { console.error("[mini-evento] conferir", i.id, e); }
  }
  let whatsapp: unknown = null;
  try { whatsapp = await abordarNovos(sb); } catch (e) { console.error("[mini-evento] abordar", e); whatsapp = { erro: String((e as Error).message || e).slice(0, 160) }; }
  return json({ conferidos: (data || []).length, pagos: n, whatsapp });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    switch (body.action) {
      case "turma": return await turma(sb, body);
      case "lead": return await lead(sb, body);
      case "visita": return await visita(sb, body, req.headers.get("user-agent") || "");
      case "checkout": return await checkout(sb, body);
      case "status": return await status(sb, body);
      case "conferir": return await conferirPendentes(sb);
      default: return json({ error: "acao_invalida" }, 400);
    }
  } catch (e) {
    console.error("[mini-evento]", e);
    return json({ error: "erro_interno" }, 500);
  }
});
