// UNV Finance: contratação direta pelo QR Code do fim da Mansão Edição Financeira (28/11/2026).
// Fabrício (16/11): o QR leva pro formulário de dados da empresa (o mesmo "Dados Contratuais" do lead
// no CRM), depois pergunta se a pessoa ainda tem dúvida. Com dúvida, agenda com o closer (Ricardo) num
// horário que esteja livre de verdade na agenda Google dele. Sem dúvida, Pix Automático de R$ 2.000/mês
// na conta Asaas principal.
//
// Página: unvholdings.com.br/finance/contratar (public/finance/contratar/index.html)
//
// action=vagas      prazo e vagas da condição do evento
// action=dados      grava os dados contratuais no lead do funil UNV Finance (cria ou atualiza) e
//                   devolve o id da contratação, que a página usa nos passos seguintes
// action=horarios   horários livres do Ricardo (freebusy do Google), dias úteis
// action=agendar    confere de novo que o horário está livre, cria o evento com Meet na agenda do
//                   Ricardo, registra a reunião no lead, move pra Agendado e avisa o lead no WhatsApp
// action=pix        Pix Automático (1ª mensalidade no QR + débito mensal autorizado), lead em Forecast
// action=status     confere se a 1ª mensalidade caiu; pago → lead em Fechado e aviso pro Fabrício
// action=conferir   cron: confere os Pix gerados que ainda não apareceram como pagos
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PIPELINE = "8e1e8cae-08ed-4b98-ac12-6b4857d0af3a"; // funil UNV Finance
const ORIGEM = "b375905d-aaea-411e-bd6f-c1ac030bad7a";   // origem UNV Finance
const ETAPA = {
  triagem: "77744ca0-3f57-438d-a5ae-9b36a96dfe02",
  agendado: "a9133185-80ea-4fcb-af84-ac6cbcba7e5d",
  forecast: "e0996f64-c3b0-4d8c-b55b-1db8e381ac98",
  fechado: "ce443a88-bfd7-47f1-9ed5-ef4f1bda7b72",
  perdido: "d0ca6928-6d04-4e02-823d-91d95b5af952",
};
const DONO_FABRICIO = "b1a918b1-8776-4962-898e-5d97c7cc80c1";
const CLOSER_STAFF = "565dc606-c2f1-45ec-b06f-bccdc1c663e7";     // Ricardo Santos
const INSTANCIA_CLOSER = "8e3ae8a2-ce4f-4101-879f-4902be129dd3"; // número do Ricardo
const INSTANCIA_AVISO = "fabricionunnes";
const AVISO_FECHOU = "5531989840003"; // WhatsApp do Fabrício: cada contrato pago vira aviso

// Condição do evento (slides 13 e 15 do pitch): R$ 2.000/mês por 12 meses, só 5 empresas, só no dia.
const VALOR = 2000;
const MESES = 12;
const VAGAS = 5;
const PRAZO = Date.parse("2026-11-28T23:59:59-03:00");

// Reunião de dúvida com o closer
const DURACAO_MIN = 30;
const HORA_INI = 9, HORA_FIM = 19;  // início entre 9h e 18h30
const DIAS_AGENDA = 3, DIAS_AGENDA_MAX = 8, MIN_HORARIOS = 4;
const ANTECEDENCIA_MIN = 120;       // não oferece horário com menos de 2h
const VALIDADE_CONTRATACAO_H = 72;  // a página só mexe na contratação que acabou de nascer
const FERIADOS = new Set(["2026-11-15", "2026-11-20", "2026-12-25", "2027-01-01"]);

// Mesmos campos personalizados que a página pública de Dados Contratuais preenche (aba Empresa do lead)
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
const dowYmd = (ymd: string) => new Date(ymd + "T12:00:00Z").getUTCDay();
const somaDias = (ymd: string, n: number) => ymdBR(Date.parse(ymd + "T12:00:00-03:00") + n * 86400000);
const somaMeses = (ymd: string, n: number) => {
  const d = new Date(ymd + "T12:00:00Z");
  const dia = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const ult = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ult));
  return d.toISOString().slice(0, 10);
};
const DIAS_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const rotulo = (ymd: string) => `${DIAS_PT[dowYmd(ymd)]}, ${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
const diaUtil = (ymd: string) => { const w = dowYmd(ymd); return w >= 1 && w <= 5 && !FERIADOS.has(ymd); };
const primeiroNome = (n: unknown) => String(n || "").trim().split(/\s+/)[0] || "";
const so = (v: unknown, max = 160) => String(v ?? "").trim().slice(0, max);
const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** DDD + 8 últimos dígitos: casa 55/sem 55 e com/sem o 9. */
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
  if (er?.waitUntil) er.waitUntil(p.catch((e) => console.error("[finance-contratar] segundo plano", e)));
  else p.catch(() => {});
}

// ── vagas ───────────────────────────────────────────────────────────────────
async function vagasRestantes(sb: SB) {
  const { count: pagos } = await sb.from("finance_contratacoes").select("id", { count: "exact", head: true }).eq("status", "pago");
  const { count: segurando } = await sb.from("finance_contratacoes").select("id", { count: "exact", head: true })
    .eq("status", "pix_gerado").gte("pix_gerado_em", new Date(Date.now() - 30 * 60000).toISOString());
  return Math.max(0, VAGAS - (pagos || 0) - (segurando || 0));
}

async function vagas(sb: SB) {
  const restantes = await vagasRestantes(sb);
  const noPrazo = Date.now() <= PRAZO;
  return json({ ok: true, aberto: noPrazo && restantes > 0, no_prazo: noPrazo, restantes, total: VAGAS, valor: VALOR, meses: MESES });
}

/** Contratação que acabou de nascer na página (trava contra mexer em qualquer lead por id). */
async function contratacaoRecente(sb: SB, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id || "")) return null;
  const { data } = await sb.from("finance_contratacoes").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  if (Date.now() - Date.parse(data.criado_em) > VALIDADE_CONTRATACAO_H * 3600000) return null;
  return data;
}

// ── dados ───────────────────────────────────────────────────────────────────
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

  // Mesma empresa voltou pro formulário com Pix ainda aberto ou já pago: segue de onde parou
  const { data: aberta } = await sb.from("finance_contratacoes").select("id, status, lead_id")
    .eq("documento", d.document).in("status", ["pix_gerado", "pago"])
    .gte("criado_em", new Date(Date.now() - 24 * 3600000).toISOString())
    .order("criado_em", { ascending: false }).limit(1).maybeSingle();

  // Lead do funil UNV Finance: o mesmo telefone ou o mesmo CNPJ
  const { data: cands } = await sb.from("crm_leads").select("id, phone, document, stage_id, notes, contract_form_token, owner_staff_id")
    .eq("pipeline_id", PIPELINE).or(`phone.ilike.*${k.slice(-8)},document.eq.${d.document}`)
    .order("created_at", { ascending: true }).limit(10);
  let lead: any = (cands || []).find((l: any) => chaveTel(l.phone) === k) ||
    (cands || []).find((l: any) => digitos(l.document) === d.document);

  const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const nota = `CONTRATAÇÃO UNV FINANCE pelo QR da Mansão (${quando}): preencheu os dados contratuais.`;
  const utm = {
    utm_source: so(body.utm_source, 80) || "mansao-qr", utm_medium: so(body.utm_medium, 80) || null,
    utm_campaign: so(body.utm_campaign, 120) || "mansao-financeira-2026-11",
  };

  if (!lead) {
    const token = crypto.randomUUID().replace(/-/g, "");
    const { data: novo, error } = await sb.from("crm_leads").insert({
      ...d, name: d.legal_representative_name, pipeline_id: PIPELINE, stage_id: ETAPA.triagem, origin_id: ORIGEM,
      owner_staff_id: DONO_FABRICIO, opportunity_value: VALOR, entered_pipeline_at: new Date().toISOString(),
      urgency: "high", notes: nota, contract_form_token: token, ...utm,
    }).select("id, stage_id").single();
    if (error || !novo) { console.error("[finance-contratar] lead", error); return json({ error: "falha_lead" }, 500); }
    lead = novo;
  } else {
    const upd: Record<string, unknown> = { ...d, opportunity_value: VALOR, notes: lead.notes ? `${nota}\n\n${lead.notes}` : nota };
    if (!lead.contract_form_token) upd.contract_form_token = crypto.randomUUID().replace(/-/g, "");
    if (!lead.owner_staff_id) upd.owner_staff_id = DONO_FABRICIO;
    if (lead.stage_id === ETAPA.perdido) Object.assign(upd, { stage_id: ETAPA.triagem, closed_at: null, loss_reason_id: null });
    const { error } = await sb.from("crm_leads").update(upd).eq("id", lead.id);
    if (error) { console.error("[finance-contratar] lead upd", error); return json({ error: "falha_lead" }, 500); }
  }

  // Aba Empresa do lead (mesmos campos da página de Dados Contratuais)
  const campos = [
    [CAMPO.razao, d.company], [CAMPO.cnpj, d.document], [CAMPO.telefone, d.phone], [CAMPO.email, d.email],
    [CAMPO.cidade, d.city], [CAMPO.uf, d.state], [CAMPO.cep, d.zipcode],
  ].map(([field_id, value]) => ({ lead_id: lead.id, field_id, value }));
  await sb.from("crm_custom_field_values").upsert(campos, { onConflict: "lead_id,field_id" });

  if (aberta && aberta.lead_id === lead.id) return json({ ok: true, id: aberta.id, lead_id: lead.id, status: aberta.status });

  const { data: c, error: ce } = await sb.from("finance_contratacoes").insert({
    lead_id: lead.id, empresa: d.trade_name || d.company, razao_social: d.company, nome: d.legal_representative_name,
    telefone: d.phone, email: d.email, documento: d.document, cidade: d.city, uf: d.state, utm,
  }).select("id").single();
  if (ce || !c) { console.error("[finance-contratar] contratacao", ce); return json({ error: "falha_salvar" }, 500); }

  // Mesmo aviso da página de Dados Contratuais (dono do lead, head comercial e masters)
  emSegundoPlano(fetch(`${SUPABASE_URL}/functions/v1/notify-contract-form-submitted`, {
    method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ leadId: lead.id }),
  }));
  return json({ ok: true, id: c.id, lead_id: lead.id, status: "dados" });
}

// ── agenda do Ricardo ───────────────────────────────────────────────────────
async function closer(sb: SB) {
  const { data } = await sb.from("onboarding_staff").select("id, name, user_id").eq("id", CLOSER_STAFF).maybeSingle();
  return data;
}

/** Horários livres de verdade no Google Agenda do closer (freebusy), dentro da janela e com antecedência. */
async function livresDoDia(userId: string, ymd: string): Promise<string[] | null> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar?action=freebusy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ target_user_id: userId, date: ymd, duration_minutes: DURACAO_MIN }),
  });
  const fb = await r.json().catch(() => ({}));
  if (!r.ok || fb.error || !Array.isArray(fb.availableSlots)) return null;
  const limite = Date.now() + ANTECEDENCIA_MIN * 60000;
  return (fb.availableSlots as string[]).filter((s) => {
    const [h, m] = s.split(":").map((x) => parseInt(x, 10));
    const minutos = h * 60 + (m || 0);
    return minutos >= HORA_INI * 60 && minutos + DURACAO_MIN <= HORA_FIM * 60 && Date.parse(`${ymd}T${s}:00-03:00`) >= limite;
  });
}

async function horarios(sb: SB, body: Record<string, unknown>) {
  const c = await contratacaoRecente(sb, String(body.id || ""));
  if (!c) return json({ error: "contratacao_invalida" }, 400);
  const cl = await closer(sb);
  if (!cl?.user_id) return json({ error: "agenda_indisponivel" }, 503);

  const uteis: string[] = [];
  let d = ymdBR(Date.now());
  for (let i = 0; i < 30 && uteis.length < DIAS_AGENDA_MAX; i++, d = somaDias(d, 1)) if (diaUtil(d)) uteis.push(d);
  const consulta = (ymd: string) => livresDoDia(cl.user_id, ymd).then((h) => ({ data: ymd, rotulo: rotulo(ymd), horarios: h }));
  const res = await Promise.all(uteis.slice(0, DIAS_AGENDA).map(consulta));
  const total = () => res.reduce((n, r) => n + (r.horarios?.length || 0), 0);
  for (let i = DIAS_AGENDA; i < uteis.length && total() < MIN_HORARIOS; i++) res.push(await consulta(uteis[i]));
  if (res.every((r) => r.horarios === null)) return json({ error: "agenda_indisponivel" }, 503);
  return json({ ok: true, closer: cl.name, duracao: DURACAO_MIN, dias: res.filter((r) => r.horarios && r.horarios.length) });
}

/** Manda a mensagem pelo número do Ricardo e deixa a conversa registrada no Atendimento, ligada ao lead. */
async function mensagemDoRicardo(sb: SB, lead: { id: string; phone: string }, texto: string) {
  const { data: inst } = await sb.from("whatsapp_instances").select("instance_name, api_url, api_key").eq("id", INSTANCIA_CLOSER).maybeSingle();
  if (!inst?.api_url) return { ok: false, erro: "instancia" };
  const base = String(inst.api_url).replace(/\/+$/, "");
  let d = digitos(lead.phone);
  if (d.length <= 11) d = "55" + d;
  try {
    const r = await fetch(`${base}/chat/whatsappNumbers/${inst.instance_name}`, {
      method: "POST", headers: { apikey: inst.api_key, "Content-Type": "application/json" }, body: JSON.stringify({ numbers: [d] }),
    });
    const w = await r.json();
    const hit = Array.isArray(w) ? w[0] : null;
    if (hit && hit.exists === false) return { ok: false, erro: "sem_whatsapp" };
    const jid = String(hit?.jid || "").split("@")[0];
    if (/^\d{12,13}$/.test(jid)) d = jid;
  } catch { /* segue com o número digitado */ }
  const s = await fetch(`${base}/message/sendText/${inst.instance_name}`, {
    method: "POST", headers: { apikey: inst.api_key, "Content-Type": "application/json" }, body: JSON.stringify({ number: d, text: texto }),
  });
  const env = await s.json().catch(() => ({}));
  if (!s.ok) return { ok: false, erro: `envio ${s.status}` };

  let { data: ct } = await sb.from("crm_whatsapp_contacts").select("id").eq("phone", d).maybeSingle();
  if (!ct) ({ data: ct } = await sb.from("crm_whatsapp_contacts").insert({ phone: d, lead_id: lead.id }).select("id").single());
  if (!ct) return { ok: true, erro: "contato" };
  const agora = new Date().toISOString();
  let { data: cv } = await sb.from("crm_whatsapp_conversations").select("id").eq("instance_id", INSTANCIA_CLOSER).eq("contact_id", ct.id).maybeSingle();
  if (!cv) {
    ({ data: cv } = await sb.from("crm_whatsapp_conversations").insert({
      instance_id: INSTANCIA_CLOSER, contact_id: ct.id, lead_id: lead.id, status: "open",
      last_message: texto.slice(0, 255), last_message_at: agora, last_message_direction: "outbound",
    }).select("id").single());
  } else {
    await sb.from("crm_whatsapp_conversations").update({ lead_id: lead.id, status: "open", last_message: texto.slice(0, 255), last_message_at: agora, last_message_direction: "outbound" }).eq("id", cv.id);
  }
  if (cv) {
    await sb.from("crm_whatsapp_messages").insert({
      conversation_id: cv.id, content: texto, type: "text", direction: "outbound", status: "sent",
      remote_id: env?.key?.id || null, is_ai: false, sent_by: null,
    });
  }
  return { ok: true };
}

async function agendar(sb: SB, body: Record<string, unknown>) {
  const c = await contratacaoRecente(sb, String(body.id || ""));
  if (!c) return json({ error: "contratacao_invalida" }, 400);
  const ymd = String(body.data || ""), hora = String(body.hora || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !/^\d{2}:\d{2}$/.test(hora) || !diaUtil(ymd)) return json({ error: "horario_invalido" }, 400);

  const { data: lead } = await sb.from("crm_leads").select("id, name, phone, email, company, trade_name, notes").eq("id", c.lead_id).maybeSingle();
  if (!lead) return json({ error: "contratacao_invalida" }, 400);

  // uma reunião futura por lead
  const { data: ja } = await sb.from("crm_activities").select("id, scheduled_at, meeting_link")
    .eq("lead_id", lead.id).eq("type", "meeting").not("status", "in", "(cancelled,canceled,no_show)")
    .gte("scheduled_at", new Date().toISOString()).limit(1).maybeSingle();
  if (ja) return json({ ok: true, ja_tinha: true, scheduled_at: ja.scheduled_at, meeting_link: ja.meeting_link });

  // Confere de novo na agenda do Ricardo: só marca se o horário continua livre agora
  const cl = await closer(sb);
  if (!cl?.user_id) return json({ error: "agenda_indisponivel" }, 503);
  const livres = await livresDoDia(cl.user_id, ymd);
  if (livres === null) return json({ error: "agenda_indisponivel" }, 503);
  if (!livres.includes(hora)) return json({ error: "horario_ocupado" }, 409);

  const ini = new Date(`${ymd}T${hora}:00-03:00`);
  const fim = new Date(ini.getTime() + DURACAO_MIN * 60000);
  const empresa = lead.trade_name || lead.company || lead.name;
  const titulo = `UNV Finance | ${empresa} + ${String(cl.name).split(" ")[0]} (UNV)`;
  const descr = `Dúvidas antes de fechar a UNV Finance (consultoria financeira + BPO, R$ ${VALOR.toLocaleString("pt-BR")}/mês). ` +
    `Agendada pelo próprio lead no QR da Mansão, depois de preencher os dados contratuais.\n\n` +
    `Responsável: ${lead.name}\nEmpresa: ${empresa}\nWhatsApp: ${lead.phone}\n\nCRM: https://unvholdings.com.br/#/crm/leads/${lead.id}`;
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(lead.email || "")) ? String(lead.email) : "";

  const r = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar?action=create-event`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: titulo, description: descr, startDateTime: ini.toISOString(), endDateTime: fim.toISOString(),
      target_user_id: cl.user_id, ...(email ? { attendees: [email] } : {}),
    }),
  });
  const ev = await r.json().catch(() => ({}));
  if (!r.ok || ev.error) { console.error("[finance-contratar] agenda", ev); return json({ error: "falha_agenda" }, 502); }

  const link = ev.event?.meetingLink || null;
  await sb.from("crm_activities").insert({
    lead_id: lead.id, type: "meeting", title: titulo, scheduled_at: ini.toISOString(), status: "pending",
    responsible_staff_id: cl.id, description: "Agendada pelo lead no QR da Mansão (tirar dúvidas antes de fechar a UNV Finance)",
    meeting_link: link, google_calendar_event_id: ev.event?.id || null, google_calendar_user_id: cl.user_id,
  });
  // Closer que recebe a reunião vira o responsável pelo lead (regra de 08/09/2026)
  await sb.from("crm_leads").update({
    owner_staff_id: cl.id, closer_staff_id: cl.id, scheduled_at: ini.toISOString(), stage_id: ETAPA.agendado,
  }).eq("id", lead.id);
  await sb.from("finance_contratacoes").update({ status: "agendado", reuniao_em: ini.toISOString() }).eq("id", c.id);

  const quando = `${rotulo(ymd)}, às ${hora}`;
  const nome = primeiroNome(lead.name);
  const texto = `Oi${nome ? `, ${nome}` : ""}! Aqui é o Ricardo, da UNV.\n\nRecebi os dados da ${empresa} e nossa conversa pra tirar suas dúvidas sobre a UNV Finance ficou marcada pra ${quando}. É rapidinho, 30 minutos.${link ? `\n\nLink da reunião: ${link}` : ""}\n\nSe quiser adiantar alguma dúvida por aqui, pode mandar.`;
  emSegundoPlano(mensagemDoRicardo(sb, lead, texto));

  return json({ ok: true, scheduled_at: ini.toISOString(), meeting_link: link, closer: cl.name, quando });
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

async function qrDaAutorizacao(sb: SB, authId: string) {
  const { data } = await sb.from("asaas_pix_automatico").select("qr_payload, qr_image, status").eq("id", authId).maybeSingle();
  return data;
}

async function pix(sb: SB, body: Record<string, unknown>) {
  const c = await contratacaoRecente(sb, String(body.id || ""));
  if (!c) return json({ error: "contratacao_invalida" }, 400);
  if (c.status === "pago") return json({ ok: true, status: "pago" });
  if (c.status === "pix_gerado" && c.pix_auth_id) {
    const q = await qrDaAutorizacao(sb, c.pix_auth_id);
    if (q?.qr_payload) return json({ ok: true, status: "pix_gerado", pix: { payload: q.qr_payload, image: q.qr_image }, link: `https://unvholdings.com.br/#/pix-automatico/${c.pix_auth_id}` });
  }
  if (Date.now() > PRAZO) return json({ error: "prazo_encerrado" }, 409);
  if ((await vagasRestantes(sb)) <= 0) return json({ error: "vagas_esgotadas" }, 409);

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

    // 1ª mensalidade hoje, no QR; os débitos de 2 a 12 saem sozinhos todo mês no mesmo dia
    const primeira = ymdBR(Date.now());
    const startDate = somaMeses(primeira, 1);
    const finishDate = somaMeses(primeira, MESES - 1);
    const description = "UNV Finance mensal";
    const empresa = lead.trade_name || lead.company || lead.name;
    const { data: lp } = await sb.from("crm_lead_payments").insert({
      lead_id: lead.id, amount_cents: VALOR * 100, description: `UNV Finance · R$ ${VALOR}/mês · ${MESES} meses · ${empresa}`.slice(0, 240),
      provider: "asaas", billing_type: "PIX_AUTOMATICO", recurring: true, due_day: Number(primeira.slice(8, 10)),
      provider_ref: null, url: "", status: "pending", payer_email: lead.email || null,
    }).select("id").single();
    const contractId = `uf${String(c.id).replace(/-/g, "")}`.slice(0, 35);
    const pedido: Record<string, unknown> = {
      customerId: customer, frequency: "MONTHLY", contractId, startDate, finishDate, value: VALOR,
      description, paymentCreationMode: "SUBSCRIPTION", retryPolicy: "ALLOW_THREE_IN_SEVEN_DAYS",
      immediateQrCode: { originalValue: VALOR, expirationSeconds: 2 * 86400, description },
    };
    let auth: any;
    try {
      auth = await asaas("/pix/automatic/authorizations", "POST", pedido);
    } catch (e) {
      // se a conta recusar a data final, cria sem ela (a recorrência é cancelada no fim do contrato)
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
      valor_cents: VALOR * 100, frequencia: "MONTHLY", primeira_cobranca: primeira, start_date: startDate,
      descricao: `UNV Finance · ${empresa}`.slice(0, 240), cliente_nome: lead.company || lead.name, status: auth.status || "CREATED",
      qr_payload: qrPayload, qr_image: qrImage, qr_expira_em: new Date(Date.now() + 2 * 86400000).toISOString(),
      ultimo_evento: "criada (QR da Mansão)", atualizado_em: new Date().toISOString(),
    });
    // provider_ref = autorização: o asaas-webhook casa o 1º pagamento por pixAutomaticAuthorizationId
    if (lp?.id) await sb.from("crm_lead_payments").update({ provider_ref: auth.id, url: link }).eq("id", lp.id);
    await sb.from("finance_contratacoes").update({
      status: "pix_gerado", pix_auth_id: auth.id, lead_payment_id: lp?.id || null, pix_gerado_em: new Date().toISOString(),
      fim_contrato: pedido.finishDate ? finishDate : null,
    }).eq("id", c.id);
    await sb.from("crm_leads").update({ stage_id: ETAPA.forecast, opportunity_value: VALOR, closed_at: null, loss_reason_id: null }).eq("id", lead.id);
    return json({ ok: true, status: "pix_gerado", pix: { payload: qrPayload, image: qrImage }, link, primeira, proximo_debito: startDate });
  } catch (e) {
    console.error("[finance-contratar] pix", e);
    return json({ error: "falha_cobranca", detalhe: String((e as Error).message || e).slice(0, 160) }, 502);
  }
}

/** Pago = o asaas-webhook marcou pago_em na autorização (1ª mensalidade caiu). Idempotente. */
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
      // a autorização só fica ACTIVE depois que o QR da 1ª mensalidade é pago
      if (au?.status === "ACTIVE") pago = true;
      if (["REFUSED", "CANCELLED", "EXPIRED"].includes(au?.status)) {
        await sb.from("finance_contratacoes").update({ status: "cancelado" }).eq("id", c.id).eq("status", "pix_gerado");
        return "cancelado";
      }
    } catch (e) { console.error("[finance-contratar] consulta", String((e as Error).message || e)); }
  }
  if (!pago) return "pix_gerado";

  const { data: trava } = await sb.from("finance_contratacoes").update({ status: "pago", pago_em: new Date().toISOString() })
    .eq("id", c.id).eq("status", "pix_gerado").select("id");
  if (!trava?.length) return "pago";
  await sb.from("crm_leads").update({
    stage_id: ETAPA.fechado, opportunity_value: VALOR, closed_at: new Date().toISOString(),
  }).eq("id", c.lead_id);
  try {
    const { count } = await sb.from("finance_contratacoes").select("id", { count: "exact", head: true }).eq("status", "pago");
    const { data: inst } = await sb.from("whatsapp_instances").select("instance_name, api_url, api_key").eq("instance_name", INSTANCIA_AVISO).maybeSingle();
    if (inst?.api_url) {
      const texto = `*UNV FINANCE FECHADO*\n\n${c.empresa}${c.cidade ? `, de ${c.cidade}` : ""}\n${c.nome}\n1ª mensalidade de R$ ${VALOR.toLocaleString("pt-BR")} paga no Pix Automático\n\nFechados até agora: ${count ?? "?"} de ${VAGAS}`;
      await fetch(`${String(inst.api_url).replace(/\/+$/, "")}/message/sendText/${inst.instance_name}`, {
        method: "POST", headers: { apikey: inst.api_key, "Content-Type": "application/json" },
        body: JSON.stringify({ number: AVISO_FECHOU, text: texto }),
      });
      await sb.from("finance_contratacoes").update({ avisado_em: new Date().toISOString() }).eq("id", c.id);
    }
  } catch (e) { console.error("[finance-contratar] aviso", e); }
  return "pago";
}

async function status(sb: SB, body: Record<string, unknown>) {
  const c = await contratacaoRecente(sb, String(body.id || ""));
  if (!c) return json({ error: "contratacao_invalida" }, 400);
  return json({ ok: true, status: await conferir(sb, c) });
}

async function conferirPendentes(sb: SB) {
  const { data } = await sb.from("finance_contratacoes").select("*").eq("status", "pix_gerado")
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
      case "vagas": return await vagas(sb);
      case "dados": return await dados(sb, body);
      case "horarios": return await horarios(sb, body);
      case "agendar": return await agendar(sb, body);
      case "pix": return await pix(sb, body);
      case "status": return await status(sb, body);
      case "conferir": return await conferirPendentes(sb);
      default: return json({ error: "acao_invalida" }, 400);
    }
  } catch (e) {
    console.error("[finance-contratar]", e);
    return json({ error: "erro_interno" }, 500);
  }
});
