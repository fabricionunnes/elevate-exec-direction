// Funil de mini-eventos (25/11/2026): ingresso de R$ 97 pago direto no site pelo Asaas.
// Páginas: unvholdings.com.br/evento (venda), /evento/checkout e /evento/obrigado.
//
// action=turma     dados públicos da turma (data, local, preço, vagas restantes)
// action=visita    registra a visita à página de venda (uma por sessão)
// action=checkout  cria/atualiza o lead no funil Mini-eventos, gera a cobrança no Asaas (Pix na tela ou cartão
//                  no link do Asaas) e leva o lead pra "Checkout iniciado"
// action=status    confere a cobrança; pago → inscrição paga, lead em "Ingresso pago", etiqueta e aviso no WhatsApp
// action=conferir  cron (mini-evento-conferir): confere os checkouts abertos dos últimos 3 dias
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
const TAG_PAGO = "e1e00000-0000-4000-8000-000000000032";
const TAG_SOCIO = "e1e00000-0000-4000-8000-000000000033";
const DONO_FABRICIO = "b1a918b1-8776-4962-898e-5d97c7cc80c1";
const INSTANCIA_AVISO = "fabricionunnes";
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

async function visita(sb: SB, body: Record<string, unknown>) {
  const t = await turmaPorSlug(sb, body.slug);
  if (!t) return json({ ok: false });
  const sessao = so(body.sessao, 60);
  if (!sessao) return json({ ok: false });
  const { data: ja } = await sb.from("miniev_eventos").select("id").eq("turma_id", t.id).eq("tipo", "pagina_vista").eq("sessao", sessao).limit(1);
  if (!ja?.length) {
    await sb.from("miniev_eventos").insert({
      turma_id: t.id, tipo: "pagina_vista", sessao,
      dados: { utm_source: so(body.utm_source, 80) || null, utm_content: so(body.utm_content, 120) || null, origem: so(body.origem, 40) || null },
    });
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
  if (aberta) return json({ id: aberta.id, status: "checkout", valor_cents: valor, pix_payload: aberta.pix_payload, pix_image: aberta.pix_image, invoice_url: aberta.invoice_url });

  const utm = {
    utm_source: so(body.utm_source, 80) || null, utm_medium: so(body.utm_medium, 80) || null, utm_campaign: so(body.utm_campaign, 120) || null,
    utm_content: so(body.utm_content, 120) || null, utm_term: so(body.utm_term, 120) || null, fbclid: so(body.fbclid, 300) || null,
  };
  const nota = `CHECKOUT DO INGRESSO (${quando()}) · ${t.nome} · ${brl(valor)}${a.com_socio ? ` · com sócio: ${a.socio_nome}` : ""}`;
  let lead = await acharLead(sb, k, a.email);
  if (!lead) {
    const { data: novo, error } = await sb.from("crm_leads").insert({
      name: a.nome, phone, email: a.email, document: a.documento, pipeline_id: PIPELINE, stage_id: ETAPA.checkout,
      origin_id: ORIGEM, origin: "Site /evento", owner_staff_id: DONO_FABRICIO, opportunity_value: valor / 100,
      entered_pipeline_at: new Date().toISOString(), notes: nota, has_partner: a.com_socio || null,
      utm_source: utm.utm_source || "site", utm_medium: utm.utm_medium, utm_campaign: utm.utm_campaign || "mini-evento",
      utm_content: utm.utm_content, utm_term: utm.utm_term, fbclid: utm.fbclid,
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
      customer: cliente.id, billingType: "UNDEFINED", value: valor / 100, dueDate: venc,
      description: `Ingresso · Workshop presencial com Fabrício Nunnes · ${t.cidade} · ${dia}/${mes}/${ano}${a.com_socio ? " · 2 pessoas" : ""}`,
      externalReference: `miniev:${insc.id}`,
    });
    let qr: any = null;
    try { qr = await asaas(`/payments/${pay.id}/pixQrCode`); } catch (e) { console.error("[mini-evento] qr", e); }
    await sb.from("miniev_inscricoes").update({
      asaas_customer_id: cliente.id, asaas_payment_id: pay.id, invoice_url: pay.invoiceUrl,
      pix_payload: qr?.payload || null, pix_image: qr?.encodedImage || null,
    }).eq("id", insc.id);
    await sb.from("miniev_eventos").insert({ turma_id: t.id, tipo: "checkout_iniciado", lead_id: lead.id, inscricao_id: insc.id, dados: { valor: valor / 100, com_socio: a.com_socio } });
    return json({ id: insc.id, status: "checkout", valor_cents: valor, pix_payload: qr?.payload || null, pix_image: qr?.encodedImage || null, invoice_url: pay.invoiceUrl });
  } catch (e) {
    console.error("[mini-evento] asaas", e);
    await sb.from("miniev_inscricoes").update({ status: "cancelado" }).eq("id", insc.id);
    return json({ error: "falha_cobranca", detalhe: String((e as Error).message || e).slice(0, 200) }, 502);
  }
}

/** Confere a cobrança no Asaas. Pago: marca a inscrição (uma vez só), anda o lead, etiqueta e avisa. */
async function conferir(sb: SB, i: any): Promise<string> {
  if (i.status === "pago") return "pago";
  if (!i.asaas_payment_id) return i.status;
  const p = await asaas(`/payments/${i.asaas_payment_id}`);
  if (!["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(p.status)) {
    if (p.deleted || p.status === "REFUNDED") await sb.from("miniev_inscricoes").update({ status: "cancelado" }).eq("id", i.id).eq("status", "checkout");
    return "checkout";
  }
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
      lead_id: i.lead_id, amount_cents: i.valor_cents, description: "Ingresso do mini-evento", provider: "asaas", provider_ref: i.asaas_payment_id,
      url: i.invoice_url, status: "paid", payer_email: i.email, paid_at: new Date().toISOString(), billing_type: p.billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX",
    }).then((r: any) => { if (r.error) console.error("[mini-evento] lead_payment", r.error); });
  }
  try {
    const { data: t } = await sb.from("miniev_turmas").select("nome, vagas").eq("id", i.turma_id).maybeSingle();
    const n = await pagos(sb, i.turma_id);
    const { data: inst } = await sb.from("whatsapp_instances").select("instance_name, api_url, api_key").eq("instance_name", INSTANCIA_AVISO).maybeSingle();
    if (inst?.api_url) {
      const texto = `*INGRESSO PAGO*\n\n${i.nome}${i.com_socio ? ` + sócio (${i.socio_nome})` : ""}\n${i.telefone}\n${brl(i.valor_cents)}\n\n${t?.nome || "Mini-evento"}: ${n} de ${t?.vagas || 25} vagas`;
      await fetch(`${String(inst.api_url).replace(/\/+$/, "")}/message/sendText/${inst.instance_name}`, {
        method: "POST", headers: { apikey: inst.api_key, "Content-Type": "application/json" },
        body: JSON.stringify({ number: AVISO_PARA, text: texto }),
      });
      await sb.from("miniev_inscricoes").update({ avisado_em: new Date().toISOString() }).eq("id", i.id);
    }
  } catch (e) { console.error("[mini-evento] aviso", e); }
  return "pago";
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
  const { data } = await sb.from("miniev_inscricoes").select("*").eq("status", "checkout").not("asaas_payment_id", "is", null)
    .gte("criado_em", new Date(Date.now() - 3 * 86400000).toISOString()).order("criado_em", { ascending: false }).limit(60);
  let n = 0;
  for (const i of data || []) {
    try { if (await conferir(sb, i) === "pago") n++; } catch (e) { console.error("[mini-evento] conferir", i.id, e); }
  }
  return json({ conferidos: (data || []).length, pagos: n });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    switch (body.action) {
      case "turma": return await turma(sb, body);
      case "visita": return await visita(sb, body);
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
