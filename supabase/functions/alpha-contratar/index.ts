// UNV Mastermind Alpha no site (24/11/2026).
// Página: unvholdings.com.br/masteralpha (aplicação) e /masteralpha/contratar (checkout, link enviado depois
// da conversa individual; não aparece no site).
//
// Regras do Fabrício:
// - Toda aplicação entra no funil Mastermind Alpha na etapa "Aplicação preenchida".
// - Faturamento abaixo de R$ 100 mil por mês não entra no Mastermind, mas a pessoa NÃO é avisada:
//   a tela de resposta é a mesma, e o lead ganha a etiqueta "Faturamento baixo".
// - Checkout: Pix Automático de R$ 1.500/mês. A 1ª mensalidade é paga no QR na hora (o Asaas exige
//   pagamento para autorizar) e as 11 seguintes saem sozinhas, a primeira delas em janeiro/2027.
//
// action=aplicar   grava a aplicação e cria/atualiza o lead
// action=dados     dados contratuais do checkout (cria/atualiza o lead) e devolve o id da contratação
// action=contrato  gera o contrato em PDF, abre o envelope de assinatura e devolve o link do cliente
//                  (depois de assinar, a tela /#/assinar devolve o cliente para o checkout, no passo do Pix)
// action=pix       Pix Automático (só com o contrato assinado pelo cliente), (1ª no QR + 11 débitos mensais a partir de jan/2027), lead em Proposta enviada
// action=status    confere se a 1ª caiu; pago → lead em Fechado e aviso no WhatsApp do Fabrício
// action=conferir  cron (alpha-contratar-conferir): confere os Pix gerados que ainda não apareceram como pagos
import { createClient } from "jsr:@supabase/supabase-js@2";
import { clausulasAlpha, gerarPdfAlpha } from "./contrato.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PIPELINE = "18c377d3-0327-4d6a-a6d9-2a40ef33548b"; // funil Mastermind Alpha
const ORIGEM = "a1fa0000-0000-4000-8000-0000000a1f40";   // origem Mastermind Alpha
const ETAPA = {
  aplicacao: "465386ef-3bc3-4687-aa07-701bc322e320",     // Aplicação preenchida (criada pelo Fabrício)
  proposta: "41a9c6cb-563f-4f97-88bd-669b9612b25d",
  fechado: "2d469072-d361-4152-8ed5-9bf44aca0682",
  perdido: "e692bd8f-c997-4e31-a91d-ed1e22b10b1c",
  foraPerfil: "422d32ed-0ec7-4658-bcad-7a5b6a0f0c4c",
};
// Etapas antes da aplicação: o lead que aplica sobe para "Aplicação preenchida". Das seguintes ele não volta.
const ETAPAS_ANTES = new Set([
  "7e58618d-a7a3-471b-93e3-7b82366f2f3b", "8aa054bf-09e0-4014-a967-3aa5b25bdd0c",
  "0be5a321-31a7-44b8-b441-13e6b0ee7349", "6b430e6e-5810-42d3-913c-150d526bc2f8",
]);
const TAG_FATURAMENTO_BAIXO = "a1fa0000-0000-4000-8000-0000000a1f52";
const DONO_FABRICIO = "b1a918b1-8776-4962-898e-5d97c7cc80c1";
const INSTANCIA_AVISO = "fabricionunnes";
const USUARIO_FABRICIO = "98f3de7f-6d6f-4f3c-b2da-b9e479ce96e3"; // auth.users do Fabrício: dono do envelope
const CHECKOUT_URL = "https://unvholdings.com.br/masteralpha/contratar/";
const AVISO_FECHOU = "5531989840003";

const FATURAMENTO_MINIMO = 100000;
const FAIXAS: Record<string, { rotulo: string; min: number }> = {
  ate50: { rotulo: "Até R$ 50 mil por mês", min: 0 },
  "50a100": { rotulo: "De R$ 50 mil a R$ 100 mil por mês", min: 50000 },
  "100a300": { rotulo: "De R$ 100 mil a R$ 300 mil por mês", min: 100000 },
  "300a1m": { rotulo: "De R$ 300 mil a R$ 1 milhão por mês", min: 300000 },
  acima1m: { rotulo: "Acima de R$ 1 milhão por mês", min: 1000000 },
};

const VALOR = 1500;
const MESES = 12;
const DIA_DEBITO = 10;                 // débitos mensais no dia 10
const PRIMEIRO_DEBITO_MIN = "2027-01-10"; // a 2ª mensalidade nunca antes de janeiro/2027
const VALIDADE_CONTRATACAO_H = 72;

const CAMPO = {
  razao: "7b67f652-0241-4ce4-a0a1-55f662156798",
  cnpj: "b3466b71-9393-421f-9de6-5f3e78a64d75",
  telefone: "2625e412-c60b-44b2-9b95-9ffb4206ba3b",
  email: "80a12445-cd5e-41ad-a3ec-41990b2dd2ff",
  cidade: "dd91421b-6808-421b-b7b4-da7e81d87702",
  uf: "e26503ad-13b4-41fd-9e7b-bc5b8efee7af",
  cep: "244d8391-d3ca-4b59-b343-68809511076a",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type SB = any;

const ymdBR = (ms: number) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10);
const somaMeses = (ymd: string, n: number) => {
  const d = new Date(ymd + "T12:00:00Z");
  const dia = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const ult = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ult));
  return d.toISOString().slice(0, 10);
};
const so = (v: unknown, max = 160) => String(v ?? "").trim().slice(0, max);
const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const quando = () => new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

function chaveTel(v: unknown): string | null {
  let d = digitos(v);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 10) return null;
  return d.slice(0, 2) + d.slice(-8);
}
function cpfOk(c: string) {
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += +c[i] * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== +c[t]) return false;
  }
  return true;
}
function cnpjOk(c: string) {
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const p = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let k = 0; k < 2; k++) {
    const pe = k ? [6, ...p] : p;
    let s = 0;
    for (let i = 0; i < pe.length; i++) s += +c[i] * pe[i];
    const r = s % 11 < 2 ? 0 : 11 - (s % 11);
    if (r !== +c[12 + k]) return false;
  }
  return true;
}
function emSegundoPlano(p: Promise<unknown>) {
  const er = (globalThis as any).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(p.catch((e) => console.error("[alpha-contratar] segundo plano", e)));
  else p.catch(() => {});
}

/** Lead do funil Alpha com o mesmo telefone (ou o mesmo CNPJ / e-mail). */
async function acharLead(sb: SB, k: string, extra?: { document?: string; email?: string }) {
  const ors = [`phone.ilike.*${k.slice(-8)}`];
  if (extra?.document) ors.push(`document.eq.${extra.document}`);
  if (extra?.email) ors.push(`email.eq.${extra.email}`);
  const { data } = await sb.from("crm_leads").select("id, phone, email, document, stage_id, notes, contract_form_token, owner_staff_id")
    .eq("pipeline_id", PIPELINE).or(ors.join(",")).order("created_at", { ascending: true }).limit(10);
  const c = data || [];
  return c.find((l: any) => chaveTel(l.phone) === k) ||
    (extra?.document ? c.find((l: any) => digitos(l.document) === extra.document) : null) ||
    (extra?.email ? c.find((l: any) => String(l.email || "").toLowerCase() === extra.email) : null) || null;
}

// ── aplicação ───────────────────────────────────────────────────────────────
async function aplicar(sb: SB, body: Record<string, unknown>) {
  const a = {
    nome: so(body.nome, 120), telefone: digitos(body.telefone), email: so(body.email, 160).toLowerCase(),
    empresa: so(body.empresa, 160), segmento: so(body.segmento, 120), cidade: so(body.cidade, 100),
    faturamento: so(body.faturamento, 20), vendedores: so(body.vendedores, 20), desafio: so(body.desafio, 1200),
  };
  if (a.nome.length < 2 || !a.empresa || !a.segmento || !a.faturamento) return json({ error: "dados_incompletos" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.email)) return json({ error: "email_invalido" }, 400);
  const k = chaveTel(a.telefone);
  if (!k) return json({ error: "telefone_invalido" }, 400);
  const faixa = FAIXAS[a.faturamento];
  if (!faixa) return json({ error: "faturamento_invalido" }, 400);
  const qualificado = faixa.min >= FATURAMENTO_MINIMO;
  const phone = a.telefone.replace(/^55(?=\d{10,11}$)/, "");
  const utm = {
    utm_source: so(body.utm_source, 80) || "site", utm_medium: so(body.utm_medium, 80) || null,
    utm_campaign: so(body.utm_campaign, 120) || "masteralpha", utm_content: so(body.utm_content, 120) || null,
    utm_term: so(body.utm_term, 120) || null, fbclid: so(body.fbclid, 300) || null,
  };

  const nota = [
    `APLICAÇÃO MASTERMIND ALPHA pelo site (${quando()})${qualificado ? "" : " · FATURAMENTO BAIXO"}`,
    `Empresa: ${a.empresa} · Segmento: ${a.segmento}${a.cidade ? ` · Cidade: ${a.cidade}` : ""}`,
    `Faturamento: ${faixa.rotulo}${a.vendedores ? ` · Vendedores: ${a.vendedores}` : ""}`,
    a.desafio ? `O que quer resolver em 12 meses: ${a.desafio}` : "",
  ].filter(Boolean).join("\n");

  let lead = await acharLead(sb, k, { email: a.email });
  if (!lead) {
    const { data: novo, error } = await sb.from("crm_leads").insert({
      name: a.nome, phone, email: a.email, company: a.empresa, trade_name: a.empresa, segment: a.segmento, city: a.cidade || null,
      main_pain: a.desafio || null, estimated_revenue: faixa.min || null, pipeline_id: PIPELINE, stage_id: ETAPA.aplicacao,
      origin_id: ORIGEM, origin: "Site /masteralpha", owner_staff_id: DONO_FABRICIO, opportunity_value: VALOR * MESES,
      entered_pipeline_at: new Date().toISOString(), urgency: qualificado ? "high" : "low", notes: nota, ...utm,
    }).select("id").single();
    if (error || !novo) { console.error("[alpha-contratar] lead", error); return json({ error: "falha_lead" }, 500); }
    lead = novo;
  } else {
    const upd: Record<string, unknown> = {
      name: a.nome, email: a.email, company: a.empresa, segment: a.segmento, main_pain: a.desafio || null,
      estimated_revenue: faixa.min || null, notes: lead.notes ? `${nota}\n\n${lead.notes}` : nota,
    };
    if (a.cidade) upd.city = a.cidade;
    if (!lead.owner_staff_id) upd.owner_staff_id = DONO_FABRICIO;
    if (ETAPAS_ANTES.has(lead.stage_id) || lead.stage_id === ETAPA.perdido || lead.stage_id === ETAPA.foraPerfil) {
      Object.assign(upd, { stage_id: ETAPA.aplicacao, closed_at: null, loss_reason_id: null });
    }
    const { error } = await sb.from("crm_leads").update(upd).eq("id", lead.id);
    if (error) { console.error("[alpha-contratar] lead upd", error); return json({ error: "falha_lead" }, 500); }
  }

  // Etiqueta: abaixo do mínimo ganha "Faturamento baixo"; quem reaplica acima do mínimo perde a etiqueta
  if (!qualificado) {
    const { data: tem } = await sb.from("crm_lead_tags").select("id").eq("lead_id", lead.id).eq("tag_id", TAG_FATURAMENTO_BAIXO).maybeSingle();
    if (!tem) await sb.from("crm_lead_tags").insert({ lead_id: lead.id, tag_id: TAG_FATURAMENTO_BAIXO });
  } else {
    await sb.from("crm_lead_tags").delete().eq("lead_id", lead.id).eq("tag_id", TAG_FATURAMENTO_BAIXO);
  }

  await sb.from("alpha_aplicacoes").insert({
    lead_id: lead.id, nome: a.nome, telefone: phone, email: a.email, empresa: a.empresa, segmento: a.segmento,
    cidade: a.cidade || null, faturamento: faixa.rotulo, faturamento_min: faixa.min, vendedores: a.vendedores || null,
    desafio: a.desafio || null, qualificado, utm,
  });
  // A resposta é a mesma para todos: quem fica abaixo do mínimo não é avisado.
  // "q" só serve para a página escolher o evento do pixel (Lead só para quem está no perfil).
  return json({ ok: true, q: qualificado ? 1 : 0 });
}

// ── checkout ────────────────────────────────────────────────────────────────
async function contratacaoRecente(sb: SB, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id || "")) return null;
  const { data } = await sb.from("alpha_contratacoes").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  if (Date.now() - Date.parse(data.criado_em) > VALIDADE_CONTRATACAO_H * 3600000) return null;
  return data;
}

async function dados(sb: SB, body: Record<string, unknown>) {
  const d = {
    company: so(body.razao_social, 160), trade_name: so(body.nome_fantasia, 160),
    document: digitos(body.cnpj), email: so(body.email, 160).toLowerCase(), phone: digitos(body.telefone),
    zipcode: digitos(body.cep), address: so(body.endereco, 200), address_number: so(body.numero, 30),
    address_complement: so(body.complemento, 100), address_neighborhood: so(body.bairro, 100),
    city: so(body.cidade, 100), state: so(body.uf, 2).toUpperCase(),
    legal_representative_name: so(body.representante, 160), marital_status: so(body.estado_civil, 40),
    rg: so(body.rg, 30), cpf: digitos(body.cpf),
  };
  const faltando = Object.entries(d).filter(([k, v]) => k !== "address_complement" && !v).map(([k]) => k);
  if (faltando.length) return json({ error: "dados_incompletos", campos: faltando }, 400);
  if (!cnpjOk(d.document)) return json({ error: "cnpj_invalido" }, 400);
  if (!cpfOk(d.cpf)) return json({ error: "cpf_invalido" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) return json({ error: "email_invalido" }, 400);
  const k = chaveTel(d.phone);
  if (!k) return json({ error: "telefone_invalido" }, 400);
  d.phone = d.phone.replace(/^55(?=\d{10,11}$)/, "");

  const { data: aberta } = await sb.from("alpha_contratacoes").select("id, status, lead_id")
    .eq("documento", d.document).in("status", ["pix_gerado", "pago"])
    .gte("criado_em", new Date(Date.now() - 24 * 3600000).toISOString())
    .order("criado_em", { ascending: false }).limit(1).maybeSingle();

  let lead: any = await acharLead(sb, k, { document: d.document, email: d.email });
  const nota = `CHECKOUT MASTERMIND ALPHA (${quando()}): preencheu os dados contratuais.`;
  const utm = { utm_source: so(body.utm_source, 80) || "checkout", utm_medium: so(body.utm_medium, 80) || null, utm_campaign: so(body.utm_campaign, 120) || "masteralpha" };

  if (!lead) {
    const token = crypto.randomUUID().replace(/-/g, "");
    const { data: novo, error } = await sb.from("crm_leads").insert({
      ...d, name: d.legal_representative_name, pipeline_id: PIPELINE, stage_id: ETAPA.proposta, origin_id: ORIGEM,
      origin: "Checkout /masteralpha/contratar", owner_staff_id: DONO_FABRICIO, opportunity_value: VALOR * MESES,
      entered_pipeline_at: new Date().toISOString(), urgency: "high", notes: nota, contract_form_token: token, ...utm,
    }).select("id, stage_id").single();
    if (error || !novo) { console.error("[alpha-contratar] lead", error); return json({ error: "falha_lead" }, 500); }
    lead = novo;
  } else {
    const upd: Record<string, unknown> = { ...d, opportunity_value: VALOR * MESES, notes: lead.notes ? `${nota}\n\n${lead.notes}` : nota };
    if (!lead.contract_form_token) upd.contract_form_token = crypto.randomUUID().replace(/-/g, "");
    if (!lead.owner_staff_id) upd.owner_staff_id = DONO_FABRICIO;
    if (lead.stage_id !== ETAPA.fechado) Object.assign(upd, { stage_id: ETAPA.proposta, closed_at: null, loss_reason_id: null });
    const { error } = await sb.from("crm_leads").update(upd).eq("id", lead.id);
    if (error) { console.error("[alpha-contratar] lead upd", error); return json({ error: "falha_lead" }, 500); }
  }

  const campos = [
    [CAMPO.razao, d.company], [CAMPO.cnpj, d.document], [CAMPO.telefone, d.phone], [CAMPO.email, d.email],
    [CAMPO.cidade, d.city], [CAMPO.uf, d.state], [CAMPO.cep, d.zipcode],
  ].map(([field_id, value]) => ({ lead_id: lead.id, field_id, value }));
  await sb.from("crm_custom_field_values").upsert(campos, { onConflict: "lead_id,field_id" });

  if (aberta && aberta.lead_id === lead.id) return json({ ok: true, id: aberta.id, status: aberta.status });

  const { data: c, error: ce } = await sb.from("alpha_contratacoes").insert({
    lead_id: lead.id, empresa: d.trade_name || d.company, razao_social: d.company, nome: d.legal_representative_name,
    telefone: d.phone, email: d.email, documento: d.document, cidade: d.city, uf: d.state, utm,
  }).select("id").single();
  if (ce || !c) { console.error("[alpha-contratar] contratacao", ce); return json({ error: "falha_salvar" }, 500); }

  emSegundoPlano(fetch(`${SUPABASE_URL}/functions/v1/notify-contract-form-submitted`, {
    method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ leadId: lead.id }),
  }));
  return json({ ok: true, id: c.id, status: "dados" });
}

// ── contrato ────────────────────────────────────────────────────────────────
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (x: string | Uint8Array) =>
  hex(await crypto.subtle.digest("SHA-256", (typeof x === "string" ? new TextEncoder().encode(x) : x) as BufferSource));
const novoToken = () => { const b = new Uint8Array(32); crypto.getRandomValues(b); return hex(b.buffer); };
const fmtCnpj = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
const fmtCpf = (c: string) => c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
const fmtCep = (c: string) => c.replace(/^(\d{5})(\d{3})$/, "$1-$2");

/** Signatário do cliente no envelope da contratação (o que não é a UNV). */
async function signatarioCliente(sb: SB, envelopeId: string, email: string) {
  const { data } = await sb.from("signers").select("id, status, email").eq("envelope_id", envelopeId).order("order_index");
  return (data || []).find((s: any) => s.email === email) || null;
}

/** Link de assinatura de uso único para o cliente, com a volta para o checkout. */
async function linkAssinatura(sb: SB, signerId: string, contratacaoId: string) {
  await sb.from("signing_tokens").delete().eq("signer_id", signerId).is("used_at", null);
  const tk = novoToken();
  const { error } = await sb.from("signing_tokens").insert({ signer_id: signerId, token_hash: await sha256(tk), expires_at: new Date(Date.now() + 7 * 86400000).toISOString() });
  if (error) throw new Error("token: " + error.message);
  const volta = `${CHECKOUT_URL}?c=${contratacaoId}`;
  return `https://unvholdings.com.br/#/assinar/${tk}?volta=${encodeURIComponent(volta)}`;
}

async function contrato(sb: SB, body: Record<string, unknown>) {
  const c = await contratacaoRecente(sb, String(body.id || ""));
  if (!c) return json({ error: "contratacao_invalida" }, 400);
  if (c.status === "pago") return json({ ok: true, status: "pago" });
  const email = String(c.email || "").toLowerCase().trim();

  if (c.envelope_id) {
    const s = await signatarioCliente(sb, c.envelope_id, email);
    if (s?.status === "signed") return json({ ok: true, status: "assinado" });
    if (s) return json({ ok: true, status: "assinar", url: await linkAssinatura(sb, s.id, c.id) });
  }

  const { data: lead } = await sb.from("crm_leads")
    .select("id, company, trade_name, document, email, phone, zipcode, address, address_number, address_complement, address_neighborhood, city, state, legal_representative_name, marital_status, rg, cpf")
    .eq("id", c.lead_id).maybeSingle();
  if (!lead) return json({ error: "contratacao_invalida" }, 400);

  const cnpj = fmtCnpj(digitos(lead.document)), cpf = fmtCpf(digitos(lead.cpf));
  const endereco = [
    `${lead.address}, ${lead.address_number}${lead.address_complement ? `, ${lead.address_complement}` : ""}`,
    lead.address_neighborhood, `${lead.city}/${lead.state}`, `CEP ${fmtCep(digitos(lead.zipcode))}`,
  ].filter(Boolean).join(", ");
  const hoje = new Date(Date.now() - 3 * 3600000);
  const clausulas = clausulasAlpha(VALOR, DIA_DEBITO);
  const empresa = lead.trade_name || lead.company;

  try {
    const pdf = await gerarPdfAlpha({
      razao: lead.company, cnpj, email, endereco, representante: lead.legal_representative_name,
      estadoCivil: String(lead.marital_status || "").toLowerCase(), rg: lead.rg, cpf, valor: VALOR, diaVencimento: DIA_DEBITO,
      data: new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate(), 12)),
    }, clausulas);

    const envelopeId = crypto.randomUUID();
    const path = `envelopes/${envelopeId}/original.pdf`;
    const { error: up } = await sb.storage.from("envelopes").upload(path, pdf, { contentType: "application/pdf", upsert: false });
    if (up) throw new Error("upload: " + up.message);
    const titulo = `Contrato - ${empresa} - UNV Mastermind Alpha`;
    const { error: ee } = await sb.from("envelopes").insert({
      id: envelopeId, owner_user_id: USUARIO_FABRICIO, title: titulo, status: "sent",
      message: "Contrato do UNV Mastermind Alpha gerado no checkout do site.",
      original_file_path: path, original_file_hash: await sha256(pdf), expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
    if (ee) throw new Error("envelope: " + ee.message);
    // Cliente primeiro (assina no checkout); a UNV recebe o aviso com o link dela quando o cliente assinar.
    const { data: sig, error: se } = await sb.from("signers").insert([
      { envelope_id: envelopeId, name: lead.legal_representative_name, email, cpf: digitos(lead.cpf), order_index: 0, status: "pending" },
      { envelope_id: envelopeId, name: "Fabrício Augusto Nunes Oliveira", email: "fabricio@universidadevendas.com.br", cpf: "07810271601", order_index: 1, status: "pending" },
    ]).select("id, email");
    if (se || !sig) throw new Error("signers: " + (se?.message || "vazio"));
    await sb.from("audit_events").insert({ envelope_id: envelopeId, event_type: "created", metadata: { origem: "checkout /masteralpha/contratar", contratacao: c.id, total_signers: 2 } });

    const venc = `${somaMeses(ymdBR(Date.now()).slice(0, 8) + "01", 1).slice(0, 8)}${String(DIA_DEBITO).padStart(2, "0")}`;
    const { error: ge } = await sb.from("generated_contracts").insert({
      client_name: lead.company, client_document: cnpj, client_address: endereco, client_email: email, client_phone: lead.phone,
      legal_rep_name: lead.legal_representative_name, legal_rep_cpf: cpf, legal_rep_rg: lead.rg, legal_rep_marital_status: lead.marital_status,
      legal_rep_nationality: "brasileiro(a)", legal_rep_profession: "empresário(a)", product_id: "mastermind-alpha", product_name: "UNV Mastermind Alpha",
      contract_value: VALOR, payment_method: "pix", installments: null, is_recurring: true, due_date: venc, start_date: ymdBR(Date.now()),
      clauses_snapshot: clausulas, envelope_id: envelopeId, created_by: USUARIO_FABRICIO,
    });
    if (ge) console.error("[alpha-contratar] generated_contracts", ge.message); // não trava a assinatura

    const cliente = sig.find((s: any) => s.email === email);
    await sb.from("alpha_contratacoes").update({ envelope_id: envelopeId }).eq("id", c.id);
    return json({ ok: true, status: "assinar", url: await linkAssinatura(sb, cliente.id, c.id) });
  } catch (e) {
    console.error("[alpha-contratar] contrato", e);
    return json({ error: "falha_contrato", detalhe: String((e as Error).message || e).slice(0, 160) }, 502);
  }
}

// ── Pix Automático ──────────────────────────────────────────────────────────
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

/** 2ª mensalidade: dia 10 do mês seguinte, nunca antes de 10/01/2027. As outras seguem todo dia 10. */
function primeiroDebito(hoje: string) {
  const prox = `${somaMeses(hoje.slice(0, 8) + "01", 1).slice(0, 8)}${String(DIA_DEBITO).padStart(2, "0")}`;
  return prox < PRIMEIRO_DEBITO_MIN ? PRIMEIRO_DEBITO_MIN : prox;
}

async function pix(sb: SB, body: Record<string, unknown>) {
  const c = await contratacaoRecente(sb, String(body.id || ""));
  if (!c) return json({ error: "contratacao_invalida" }, 400);
  if (c.status === "pago") return json({ ok: true, status: "pago" });
  // O Pix só sai depois que o cliente assina o contrato.
  const sigC = c.envelope_id ? await signatarioCliente(sb, c.envelope_id, String(c.email || "").toLowerCase().trim()) : null;
  if (sigC?.status !== "signed") return json({ error: "contrato_pendente" }, 409);
  if (!c.contrato_assinado_em) await sb.from("alpha_contratacoes").update({ contrato_assinado_em: new Date().toISOString() }).eq("id", c.id);
  if (c.status === "pix_gerado" && c.pix_auth_id) {
    const { data: q } = await sb.from("asaas_pix_automatico").select("qr_payload, qr_image").eq("id", c.pix_auth_id).maybeSingle();
    if (q?.qr_payload) return json({ ok: true, status: "pix_gerado", pix: { payload: q.qr_payload, image: q.qr_image }, link: `https://unvholdings.com.br/#/pix-automatico/${c.pix_auth_id}`, proximo_debito: c.primeiro_debito });
  }

  const { data: lead } = await sb.from("crm_leads")
    .select("id, name, phone, email, company, trade_name, document, zipcode, address, address_number, address_complement, address_neighborhood")
    .eq("id", c.lead_id).maybeSingle();
  if (!lead) return json({ error: "contratacao_invalida" }, 400);
  const doc = digitos(lead.document);

  try {
    let customer: string | null = null;
    const achou = await asaas(`/customers?cpfCnpj=${doc}`);
    if (achou?.data?.length) customer = achou.data[0].id;
    if (!customer) {
      customer = (await asaas("/customers", "POST", {
        name: lead.company || lead.trade_name || lead.name, cpfCnpj: doc, email: lead.email || undefined,
        mobilePhone: digitos(lead.phone) || undefined, company: lead.trade_name || undefined,
        postalCode: digitos(lead.zipcode) || undefined, address: lead.address || undefined,
        addressNumber: lead.address_number || undefined, complement: lead.address_complement || undefined,
        province: lead.address_neighborhood || undefined,
      })).id;
    }

    const hoje = ymdBR(Date.now());
    const startDate = primeiroDebito(hoje);
    const finishDate = somaMeses(startDate, MESES - 2); // 11 débitos: startDate + 10 meses
    const description = "Mastermind Alpha mensal";
    const empresa = lead.trade_name || lead.company || lead.name;
    const { data: lp } = await sb.from("crm_lead_payments").insert({
      lead_id: lead.id, amount_cents: VALOR * 100, description: `Mastermind Alpha · R$ ${VALOR}/mês · ${MESES} meses · ${empresa}`.slice(0, 240),
      provider: "asaas", billing_type: "PIX_AUTOMATICO", recurring: true, due_day: DIA_DEBITO,
      provider_ref: null, url: "", status: "pending", payer_email: lead.email || null,
    }).select("id").single();
    const contractId = `ma${String(c.id).replace(/-/g, "")}`.slice(0, 35);
    const pedido: Record<string, unknown> = {
      customerId: customer, frequency: "MONTHLY", contractId, startDate, finishDate, value: VALOR,
      description, paymentCreationMode: "SUBSCRIPTION", retryPolicy: "ALLOW_THREE_IN_SEVEN_DAYS",
      immediateQrCode: { originalValue: VALOR, expirationSeconds: 2 * 86400, description: "Mastermind Alpha 1a mensalidade" },
    };
    let auth: any;
    try {
      auth = await asaas("/pix/automatic/authorizations", "POST", pedido);
    } catch (e) {
      if (/finish/i.test(String((e as Error).message))) {
        delete pedido.finishDate;
        try { auth = await asaas("/pix/automatic/authorizations", "POST", pedido); } catch (e2) { if (lp?.id) await sb.from("crm_lead_payments").delete().eq("id", lp.id); throw e2; }
      } else {
        if (lp?.id) await sb.from("crm_lead_payments").delete().eq("id", lp.id);
        throw e;
      }
    }
    const qrPayload = auth?.immediateQrCode?.payload || auth?.payload || null;
    const qrImage = auth?.immediateQrCode?.encodedImage || auth?.encodedImage || null;
    const link = `https://unvholdings.com.br/#/pix-automatico/${auth.id}`;
    await sb.from("asaas_pix_automatico").upsert({
      id: auth.id, origem: "lead", lead_id: lead.id, lead_payment_id: lp?.id || null, conta_crm: "principal",
      customer_id: customer, subscription_id: auth.subscriptionId || null, contract_id: contractId,
      valor_cents: VALOR * 100, frequencia: "MONTHLY", primeira_cobranca: hoje, start_date: startDate,
      descricao: `Mastermind Alpha · ${empresa}`.slice(0, 240), cliente_nome: lead.company || lead.name, status: auth.status || "CREATED",
      qr_payload: qrPayload, qr_image: qrImage, qr_conciliacao: auth?.immediateQrCode?.conciliationIdentifier || null,
      qr_expira_em: new Date(Date.now() + 2 * 86400000).toISOString(),
      ultimo_evento: "criada (checkout do site)", atualizado_em: new Date().toISOString(),
    });
    if (lp?.id) await sb.from("crm_lead_payments").update({ provider_ref: auth.id, url: link }).eq("id", lp.id);
    await sb.from("alpha_contratacoes").update({
      status: "pix_gerado", pix_auth_id: auth.id, lead_payment_id: lp?.id || null, pix_gerado_em: new Date().toISOString(),
      primeiro_debito: startDate, fim_contrato: pedido.finishDate ? finishDate : null,
    }).eq("id", c.id);
    await sb.from("crm_leads").update({ stage_id: ETAPA.proposta, opportunity_value: VALOR * MESES, closed_at: null, loss_reason_id: null }).eq("id", lead.id);
    return json({ ok: true, status: "pix_gerado", pix: { payload: qrPayload, image: qrImage }, link, proximo_debito: startDate });
  } catch (e) {
    console.error("[alpha-contratar] pix", e);
    return json({ error: "falha_cobranca", detalhe: String((e as Error).message || e).slice(0, 160) }, 502);
  }
}

async function conferir(sb: SB, c: any): Promise<string> {
  if (!c?.pix_auth_id || c.status !== "pix_gerado") return c?.status || "dados";
  const { data: pa } = await sb.from("asaas_pix_automatico").select("id, status, pago_em, atualizado_em").eq("id", c.pix_auth_id).maybeSingle();
  let pago = !!pa?.pago_em;
  if (!pago && pa && Date.now() - Date.parse(pa.atualizado_em) > 20000) {
    try {
      const au = await asaas(`/pix/automatic/authorizations/${c.pix_auth_id}`);
      const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
      if (au?.status && au.status !== pa.status) { patch.status = au.status; patch.ultimo_evento = "consulta"; }
      if (au?.subscriptionId) patch.subscription_id = au.subscriptionId;
      await sb.from("asaas_pix_automatico").update(patch).eq("id", pa.id);
      if (au?.status === "ACTIVE") pago = true;
      if (["REFUSED", "CANCELLED", "EXPIRED"].includes(au?.status)) {
        await sb.from("alpha_contratacoes").update({ status: "cancelado" }).eq("id", c.id).eq("status", "pix_gerado");
        return "cancelado";
      }
    } catch (e) { console.error("[alpha-contratar] consulta", String((e as Error).message || e)); }
  }
  if (!pago) return "pix_gerado";

  const { data: trava } = await sb.from("alpha_contratacoes").update({ status: "pago", pago_em: new Date().toISOString() })
    .eq("id", c.id).eq("status", "pix_gerado").select("id");
  if (!trava?.length) return "pago";
  await sb.from("crm_leads").update({ stage_id: ETAPA.fechado, opportunity_value: VALOR * MESES, closed_at: new Date().toISOString() }).eq("id", c.lead_id);
  try {
    const { count } = await sb.from("alpha_contratacoes").select("id", { count: "exact", head: true }).eq("status", "pago");
    const { data: inst } = await sb.from("whatsapp_instances").select("instance_name, api_url, api_key").eq("instance_name", INSTANCIA_AVISO).maybeSingle();
    if (inst?.api_url) {
      const deb = c.primeiro_debito ? `${c.primeiro_debito.slice(8, 10)}/${c.primeiro_debito.slice(5, 7)}/${c.primeiro_debito.slice(0, 4)}` : "?";
      const texto = `*MASTERMIND ALPHA FECHADO*\n\n${c.empresa}${c.cidade ? `, de ${c.cidade}` : ""}\n${c.nome}\n1ª mensalidade de R$ ${VALOR.toLocaleString("pt-BR")} paga no Pix Automático\nPróximo débito: ${deb}\n\nMembros pelo site até agora: ${count ?? "?"}`;
      await fetch(`${String(inst.api_url).replace(/\/+$/, "")}/message/sendText/${inst.instance_name}`, {
        method: "POST", headers: { apikey: inst.api_key, "Content-Type": "application/json" },
        body: JSON.stringify({ number: AVISO_FECHOU, text: texto }),
      });
      await sb.from("alpha_contratacoes").update({ avisado_em: new Date().toISOString() }).eq("id", c.id);
    }
  } catch (e) { console.error("[alpha-contratar] aviso", e); }
  return "pago";
}

async function status(sb: SB, body: Record<string, unknown>) {
  const c = await contratacaoRecente(sb, String(body.id || ""));
  if (!c) return json({ error: "contratacao_invalida" }, 400);
  return json({ ok: true, status: await conferir(sb, c) });
}

async function conferirPendentes(sb: SB) {
  const { data } = await sb.from("alpha_contratacoes").select("*").eq("status", "pix_gerado")
    .gte("pix_gerado_em", new Date(Date.now() - 72 * 3600000).toISOString()).limit(30);
  let n = 0;
  for (const c of data || []) if ((await conferir(sb, c)) === "pago") n++;
  return json({ ok: true, conferidas: (data || []).length, pagas: n });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    switch (body.action) {
      case "aplicar": return await aplicar(sb, body);
      case "dados": return await dados(sb, body);
      case "contrato": return await contrato(sb, body);
      case "pix": return await pix(sb, body);
      case "status": return await status(sb, body);
      case "conferir": return await conferirPendentes(sb);
      default: return json({ error: "acao_invalida" }, 400);
    }
  } catch (e) {
    console.error("[alpha-contratar]", e);
    return json({ error: "erro_interno" }, 500);
  }
});
