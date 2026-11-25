// Black UNV (novembro/2026): função pública da campanha.
//
// action=aplicou      chamada pela página /black logo depois do submit-pipeline-form:
//                     grava a aplicação completa nas observações e move o lead pra "Aplicou"
//                     (ou "Perdido" com motivo Fora do ICP). Junta com o lead que já estava na
//                     base quando o telefone bate e o formulário criou outro.
// action=horarios     horários livres do closer (Ricardo) nos próximos dias úteis.
// action=agendar      cria o evento na agenda do Ricardo, registra a reunião no lead e move
//                     pra "Agendou".
// action=grupo-sync   cron a cada 2 min: lê os participantes do grupo da Black e move o lead
//                     pra "Entrou no grupo" ou "Saiu do grupo".
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PIPELINE = "c6684582-3997-42ed-bf0f-2e418053962c"; // funil Black Friday
const ETAPA = {
  base: "34703759-efa1-4b14-b05c-d1a3ec1a4cb2",
  disparo: "68ea903a-9385-48bc-9701-108b0974afb6",
  entrouGrupo: "f4b9d022-23a6-46d1-8a00-710813bf99d6",
  confirmouLive: "ad297fc6-ded1-4c8c-95f8-bcb806c5bcb4",
  entrouLive: "da053c2c-5a83-4705-97da-d2cce6e61f8f",
  saiuGrupo: "bd85787b-a72c-4aec-996c-48c81ccc881b",
  aplicou: "ef2c955e-7b99-4454-993d-887d33157dc1",
  agendou: "7cdef1c1-9a3a-40f6-9ce8-482abc4b1d2a",
  forecast: "85325e26-8eec-403e-bfd2-1b2af60daf4a",
  ganho: "1eb375ec-b150-4c69-ad17-7272f765913e",
  perdido: "ff1f5675-cd00-493c-9d64-b066a0e87b79",
};
const MOTIVO_FORA_ICP = "eb97a200-bd96-4e92-8489-79b417e58198";
const MOTIVO_PRECO = "e13f527e-11a5-49fb-be64-5679cd397b9d";
const CLOSER_STAFF = "565dc606-c2f1-45ec-b06f-bccdc1c663e7"; // Ricardo Santos
const INSTANCIA = "fabricionunnes";            // dona do grupo
const AGENTE = "4d7f2d92-01e3-4416-8ae7-b3bad7d48ec3"; // agente "Black Friday - Ricardo Santos"
const INSTANCIA_CLOSER = "8e3ae8a2-ce4f-4101-879f-4902be129dd3"; // número do Ricardo
const CONTATO_APOS_MIN = 15;        // aplicou e não agendou: Ricardo chama depois disso
const CONTATO_HORA_INI = 8, CONTATO_HORA_FIM = 21;
const GRUPO = "120363427614204052@g.us";

const DURACAO_MIN = 60;
const HORA_INI = 9, HORA_FIM = 19; // início das reuniões entre 9h e 18h
// Até 3 dias úteis pra marcar; só abre mais dias se esses estiverem quase cheios
const DIAS_AGENDA = 3, DIAS_AGENDA_MAX = 8, MIN_HORARIOS = 4;
const ANTECEDENCIA_MIN = 120;       // não oferece horário com menos de 2h
const JANELA_APLICACAO_MIN = 120;   // a página só mexe em lead que acabou de aplicar

// Feriados nacionais até o fim da campanha (20/11 é Consciência Negra)
const FERIADOS = new Set(["2026-11-02", "2026-11-15", "2026-11-20", "2026-12-25", "2027-01-01"]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type SB = any; // sem tipos gerados do banco nesta função

/** DDD + 8 últimos dígitos: casa 55/sem 55 e com/sem o 9. */
function chaveTel(v: unknown): string | null {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 10) return null;
  return d.slice(0, 2) + d.slice(-8);
}

const ymdBR = (ms: number) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10);
const dowYmd = (ymd: string) => new Date(ymd + "T12:00:00Z").getUTCDay();
const somaDias = (ymd: string, n: number) => ymdBR(Date.parse(ymd + "T12:00:00-03:00") + n * 86400000);
const DIAS_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const rotulo = (ymd: string) => `${DIAS_PT[dowYmd(ymd)]}, ${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
const diaUtil = (ymd: string) => { const w = dowYmd(ymd); return w >= 1 && w <= 5 && !FERIADOS.has(ymd); };

/** Lead da Black que acabou de passar pelo formulário (trava contra mexer em qualquer lead por id). */
async function leadRecente(sb: SB, leadId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(leadId || "")) return null;
  const { data } = await sb.from("crm_leads")
    .select("id, name, phone, email, company, notes, stage_id, pipeline_id, entered_pipeline_at, created_at, owner_staff_id")
    .eq("id", leadId).eq("pipeline_id", PIPELINE).maybeSingle();
  if (!data) return null;
  const ref = Date.parse(data.entered_pipeline_at || data.created_at || "");
  if (!ref || Date.now() - ref > JANELA_APLICACAO_MIN * 60000) return null;
  return data;
}

async function closerUserId(sb: SB) {
  const { data } = await sb.from("onboarding_staff").select("id, name, user_id").eq("id", CLOSER_STAFF).maybeSingle();
  return data;
}

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
    const h = parseInt(s.split(":")[0], 10);
    return h >= HORA_INI && h < HORA_FIM && Date.parse(`${ymd}T${s}:00-03:00`) >= limite;
  });
}

/**
 * Puxa a conversa pelo número do Ricardo e deixa o agente da Black com ela: registra contato,
 * conversa e mensagem (o Evolution não ecoa o que sai pela API) e liga o agente na conversa.
 * Assim a confirmação de véspera/1h do motor e as respostas do lead caem no mesmo histórico.
 */
async function abrirConversa(sb: SB, lead: { id: string; phone: string }, texto: string) {
  const { data: inst } = await sb.from("whatsapp_instances").select("instance_name, api_url, api_key").eq("id", INSTANCIA_CLOSER).maybeSingle();
  if (!inst?.api_url) return { ok: false, erro: "instancia" };
  const base = String(inst.api_url).replace(/\/+$/, "");
  let d = String(lead.phone || "").replace(/\D/g, "");
  if (d.length <= 11) d = "55" + d;
  // número canônico do WhatsApp (com ou sem o 9), igual ao que o webhook grava
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
  if (!cv) return { ok: true, erro: "conversa" };
  await sb.from("crm_whatsapp_messages").insert({
    conversation_id: cv.id, content: texto, type: "text", direction: "outbound", status: "sent",
    remote_id: env?.key?.id || null, is_ai: true, sent_by: null,
  });
  await sb.from("crm_ai_agent_conversation_overrides").upsert(
    { agent_id: AGENTE, conversation_id: cv.id, channel: "whatsapp", enabled: true, reply_mode: "auto" },
    { onConflict: "conversation_id,channel" },
  );
  return { ok: true, conversa: cv.id };
}

const primeiroNome = (n: unknown) => String(n || "").trim().split(/\s+/)[0] || "";

// ── aplicou ─────────────────────────────────────────────────────────────────
async function aplicou(sb: SB, body: Record<string, unknown>) {
  let lead = await leadRecente(sb, String(body.lead_id || ""));
  if (!lead) return json({ error: "lead_invalido" }, 400);

  // O formulário só reconhece telefone idêntico. Se o lead da base foi importado com 55
  // ou sem o 9, nasceu um segundo: fica o da base (que tem o histórico do disparo) e o
  // novo vai pra Lixeira.
  const chave = chaveTel(lead.phone);
  const recemCriado = Date.now() - Date.parse(lead.created_at) < 10 * 60000;
  if (chave && recemCriado) {
    const { data: irmaos } = await sb.from("crm_leads")
      .select("id, name, phone, email, company, notes, stage_id, pipeline_id, entered_pipeline_at, created_at, owner_staff_id")
      .eq("pipeline_id", PIPELINE).neq("id", lead.id).ilike("phone", `%${chave.slice(-8)}`)
      .order("created_at", { ascending: true }).limit(5);
    const antigo = (irmaos || []).find((l: any) => chaveTel(l.phone) === chave);
    if (antigo) {
      await sb.from("crm_leads").update({
        email: antigo.email || lead.email,
        company: antigo.company || lead.company,
        entered_pipeline_at: new Date().toISOString(),
      }).eq("id", antigo.id);
      await sb.from("crm_leads").delete().eq("id", lead.id);
      lead = { ...antigo, email: antigo.email || lead.email };
    }
  }

  const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const linhas = [
    `APLICAÇÃO BLACK UNV (${quando})`,
    `Dono/sócio: ${String(body.empresario || "-")}`,
    `Empresa: ${String(body.empresa || "-")}`,
    `Pessoas vendendo: ${String(body.vendedores || "-")}`,
    `Faturamento: ${String(body.faturamento || "-")}`,
    `Tráfego pago: ${String(body.trafego || "-")}`,
    `Ciente do investimento de R$ 2.000/mês: ${String(body.investimento || "-")}`,
    `Maior dificuldade: ${String(body.dificuldade || "").trim() || "não respondeu"}`,
  ];
  const desq = body.desqualificado ? String(body.desqualificado).slice(0, 120) : null;
  if (desq) linhas.unshift(`DESQUALIFICADO: ${desq}`);
  const bloco = linhas.join("\n").slice(0, 3000);
  const notas = lead.notes ? `${bloco}\n\n${lead.notes}` : bloco;

  // Só avança: quem já agendou ou passou da aplicação não volta pra trás.
  const { data: etapas } = await sb.from("crm_stages").select("id, sort_order").eq("pipeline_id", PIPELINE);
  const ordem = new Map((etapas || []).map((e: any) => [e.id, e.sort_order]));
  const atual = ordem.get(lead.stage_id) ?? 0;
  const upd: Record<string, unknown> = { notes: notas };
  if (desq) {
    if (lead.stage_id !== ETAPA.perdido && atual < (ordem.get(ETAPA.agendou) ?? 7)) {
      Object.assign(upd, { stage_id: ETAPA.perdido, loss_reason_id: /invest/i.test(desq) ? MOTIVO_PRECO : MOTIVO_FORA_ICP, closed_at: new Date().toISOString() });
    }
  } else if (atual < (ordem.get(ETAPA.aplicou) ?? 6) || lead.stage_id === ETAPA.perdido) {
    Object.assign(upd, { stage_id: ETAPA.aplicou, closed_at: null, loss_reason_id: null });
  }
  const { error } = await sb.from("crm_leads").update(upd).eq("id", lead.id);
  if (error) return json({ error: "falha_ao_salvar" }, 500);
  return json({ ok: true, lead_id: lead.id, desqualificado: !!desq });
}

// ── horários ────────────────────────────────────────────────────────────────
async function horarios(sb: SB, body: Record<string, unknown>) {
  const lead = await leadRecente(sb, String(body.lead_id || ""));
  if (!lead) return json({ error: "lead_invalido" }, 400);
  const closer = await closerUserId(sb);
  if (!closer?.user_id) return json({ error: "agenda_indisponivel" }, 503);

  const uteis: string[] = [];
  let d = ymdBR(Date.now());
  for (let i = 0; i < 30 && uteis.length < DIAS_AGENDA_MAX; i++, d = somaDias(d, 1)) if (diaUtil(d)) uteis.push(d);

  const consulta = (ymd: string) => livresDoDia(closer.user_id, ymd).then((h) => ({ data: ymd, rotulo: rotulo(ymd), horarios: h }));
  const res = await Promise.all(uteis.slice(0, DIAS_AGENDA).map(consulta));
  const total = () => res.reduce((n, r) => n + (r.horarios?.length || 0), 0);
  for (let i = DIAS_AGENDA; i < uteis.length && total() < MIN_HORARIOS; i++) res.push(await consulta(uteis[i]));
  if (res.every((r) => r.horarios === null)) return json({ error: "agenda_indisponivel" }, 503);
  return json({ closer: closer.name, duracao: DURACAO_MIN, dias: res.filter((r) => r.horarios && r.horarios.length) });
}

// ── agendar ─────────────────────────────────────────────────────────────────
async function agendar(sb: SB, body: Record<string, unknown>) {
  const lead = await leadRecente(sb, String(body.lead_id || ""));
  if (!lead) return json({ error: "lead_invalido" }, 400);
  const ymd = String(body.data || ""), hora = String(body.hora || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !/^\d{2}:\d{2}$/.test(hora) || !diaUtil(ymd)) return json({ error: "horario_invalido" }, 400);

  // uma reunião futura por lead
  const { data: ja } = await sb.from("crm_activities").select("id, scheduled_at, meeting_link")
    .eq("lead_id", lead.id).eq("type", "meeting").not("status", "in", "(cancelled,canceled,no_show)")
    .gte("scheduled_at", new Date().toISOString()).limit(1).maybeSingle();
  if (ja) return json({ ok: true, ja_tinha: true, scheduled_at: ja.scheduled_at, meeting_link: ja.meeting_link });

  const closer = await closerUserId(sb);
  if (!closer?.user_id) return json({ error: "agenda_indisponivel" }, 503);
  const livres = await livresDoDia(closer.user_id, ymd);
  if (!livres || !livres.includes(hora)) return json({ error: "horario_ocupado" }, 409);

  const ini = new Date(`${ymd}T${hora}:00-03:00`);
  const fim = new Date(ini.getTime() + DURACAO_MIN * 60000);
  const titulo = `Black UNV | ${lead.company || lead.name} + ${closer.name.split(" ")[0]} (UNV)`;
  const descr = `Reunião da Black UNV agendada pelo próprio lead na aplicação.\n\nLead: ${lead.name}\nWhatsApp: ${lead.phone}\n\n${String(lead.notes || "").slice(0, 1500)}\n\nCRM: https://unvholdings.com.br/#/crm/leads/${lead.id}`;
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(lead.email || "")) ? String(lead.email) : "";

  const r = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar?action=create-event`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: titulo, description: descr, startDateTime: ini.toISOString(), endDateTime: fim.toISOString(),
      target_user_id: closer.user_id, ...(email ? { attendees: [email] } : {}),
    }),
  });
  const ev = await r.json().catch(() => ({}));
  if (!r.ok || ev.error) return json({ error: "falha_agenda" }, 502);

  const link = ev.event?.meetingLink || null;
  await sb.from("crm_activities").insert({
    lead_id: lead.id, type: "meeting", title: titulo, scheduled_at: ini.toISOString(), status: "pending",
    responsible_staff_id: closer.id, description: "Agendada pelo lead na aplicação da Black UNV",
    ai_agent_id: AGENTE, // a confirmação de véspera e de 1h do motor sai por este agente
    meeting_link: link, google_calendar_event_id: ev.event?.id || null, google_calendar_user_id: closer.user_id,
  });
  // Closer que recebe a reunião vira o responsável pelo lead (regra de 08/09/2026)
  await sb.from("crm_leads").update({
    owner_staff_id: closer.id, closer_staff_id: closer.id, scheduled_at: ini.toISOString(),
    stage_id: ETAPA.agendou,
  }).eq("id", lead.id);

  const quando = `${rotulo(ymd)}, às ${hora}`; // "quarta, 11/11, às 14:00"
  const nome = primeiroNome(lead.name);
  const texto = `Oi${nome ? `, ${nome}` : ""}! Aqui é o Ricardo, da UNV.\n\nVi sua aplicação pra Black UNV e nossa conversa ficou marcada pra ${quando}. Minha agenda está bem cheia nessa semana da Black, então esse horário ficou separado pra você. Conto com você.${link ? `\n\nLink da reunião: ${link}` : ""}\n\nVocê vai entrar pelo computador ou pelo celular?`;
  const conv = await abrirConversa(sb, lead, texto);
  await sb.from("black_contatos").upsert({ lead_id: lead.id, tipo: "agendou", enviado_em: new Date().toISOString(), erro: conv.ok ? (conv.erro || null) : conv.erro });

  return json({ ok: true, scheduled_at: ini.toISOString(), meeting_link: link, closer: closer.name });
}

// ── entrada na live ─────────────────────────────────────────────────────────
// A live é quarta, 25/11/2026, às 20h (Brasília). Conta quem passa por /black/entrar entre 19h e 23h59.
const LIVE_INI = Date.parse("2026-11-25T19:00:00-03:00");
const LIVE_FIM = Date.parse("2026-11-25T23:59:59-03:00");
const MEET_LIVE = "https://meet.google.com/myn-tbqg-maf";

async function entrouLive(sb: SB, body: Record<string, unknown>) {
  const k = chaveTel(body.telefone);
  if (!k) return json({ error: "telefone_invalido" }, 400);
  const agora = Date.now();
  if (agora < LIVE_INI) return json({ ok: true, status: "antes", inicio: new Date(LIVE_INI).toISOString() });
  if (agora > LIVE_FIM) return json({ ok: true, status: "depois" });

  const tel = String(body.telefone).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  const nome = String(body.nome || "").trim().slice(0, 80);
  const { data: cands } = await sb.from("crm_leads").select("id, phone, stage_id").eq("pipeline_id", PIPELINE)
    .ilike("phone", `%${k.slice(-8)}`).order("created_at", { ascending: true }).limit(10);
  let lead = (cands || []).find((l: any) => chaveTel(l.phone) === k);
  if (!lead) {
    const { data: novo } = await sb.from("crm_leads").insert({
      name: nome || `Live Black ${tel}`, phone: tel, pipeline_id: PIPELINE, stage_id: ETAPA.entrouLive,
      entered_pipeline_at: new Date().toISOString(), urgency: "medium",
      notes: "Entrou na live da Black UNV (25/11) sem estar na base",
    }).select("id, phone, stage_id").single();
    lead = novo;
  } else if ([ETAPA.base, ETAPA.disparo, ETAPA.entrouGrupo, ETAPA.confirmouLive, ETAPA.saiuGrupo].includes(lead.stage_id)) {
    // Só avança: quem já aplicou ou agendou não volta pra "Entrou na live"
    await sb.from("crm_leads").update({ stage_id: ETAPA.entrouLive }).eq("id", lead.id);
  }
  await sb.from("black_live_presenca").upsert(
    { chave: k, telefone: tel, nome: nome || null, lead_id: lead?.id || null, entrou_em: new Date().toISOString() },
    { onConflict: "chave", ignoreDuplicates: true },
  );
  return json({ ok: true, status: "aberta", meet: MEET_LIVE });
}

// ── grupo ───────────────────────────────────────────────────────────────────
// ── confirmação de presença na live (/black/live) ───────────────────────────
// Cria ou acha o lead do funil Black Friday e põe em "Confirmou live" (etapa criada em 18/11 a pedido
// do Fabrício). Só avança quem está antes disso (Base, Disparo efetuado, Entrou no grupo, Saiu do grupo);
// quem já aplicou, agendou ou entrou na live fica onde está. Sem aviso pro comercial.
async function confirmouLive(sb: SB, body: Record<string, unknown>) {
  const nome = String(body.nome || "").trim().slice(0, 120);
  const k = chaveTel(body.telefone);
  if (nome.length < 2 || !k) return json({ error: "dados_incompletos" }, 400);
  const tel = String(body.telefone).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  const emailBruto = String(body.email || "").trim().toLowerCase().slice(0, 120);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailBruto) ? emailBruto : "";
  const { data: cands } = await sb.from("crm_leads").select("id, phone, stage_id, email").eq("pipeline_id", PIPELINE)
    .ilike("phone", `%${k.slice(-8)}`).order("created_at", { ascending: true }).limit(10);
  const achou: any = (cands || []).find((l: any) => chaveTel(l.phone) === k);
  if (achou) {
    const upd: Record<string, unknown> = {};
    if ([ETAPA.base, ETAPA.disparo, ETAPA.entrouGrupo, ETAPA.saiuGrupo].includes(achou.stage_id)) upd.stage_id = ETAPA.confirmouLive;
    if (email && !achou.email) upd.email = email;
    if (Object.keys(upd).length) await sb.from("crm_leads").update(upd).eq("id", achou.id);
    await registrarConfirmado(sb, tel, nome, achou.id);
    if (email) await convidarNaLive(sb, email, nome, achou.id);
    return json({ ok: true, lead_id: achou.id, novo: false });
  }
  const { data: novo } = await sb.from("crm_leads").insert({
    name: nome, phone: tel, email: email || null, pipeline_id: PIPELINE, stage_id: ETAPA.confirmouLive, owner_staff_id: DONO_FABRICIO,
    entered_pipeline_at: new Date().toISOString(), urgency: "medium",
    notes: "Confirmou presença na live da Black UNV (/black/live) sem estar na base",
    utm_source: String(body.utm_source || "").slice(0, 200) || null, utm_medium: String(body.utm_medium || "").slice(0, 200) || null,
    utm_campaign: String(body.utm_campaign || "").slice(0, 200) || null,
  }).select("id").single();
  if (email) await convidarNaLive(sb, email, nome, novo?.id || null);
  await registrarConfirmado(sb, tel, nome, novo?.id || null);
  return json({ ok: true, lead_id: novo?.id || null, novo: !!novo });
}

// ── convite da live na agenda do Google ─────────────────────────────────────
// Fabrício, 24/11: "na confirmação da live já deixar cadastrado o e-mail do participante no evento,
// pra aparecer na agenda deles". Quem confirma em /black/live entra em black_live_convidados e vira
// convidado do evento da live na agenda do Fabrício (o Google manda o convite pro e-mail). A conferência
// roda logo na confirmação e de novo no cron de 2 min: lê o evento, junta quem falta e faz um PATCH só.
// Como sempre compara a lista inteira com o evento, um convidado perdido por duas gravações juntas volta
// sozinho. Convidado não vê a lista dos outros nem pode convidar ninguém.
const GOOGLE_USER_FABRICIO = "98f3de7f-6d6f-4f3c-b2da-b9e479ce96e3";
let eventoLiveId: string | null = null;

async function tokenGoogleFabricio(sb: SB): Promise<string | null> {
  const { data: t } = await sb.from("user_google_tokens").select("access_token, refresh_token, token_expires_at")
    .eq("user_id", GOOGLE_USER_FABRICIO).maybeSingle();
  if (!t?.access_token) return null;
  if (!t.token_expires_at || new Date(t.token_expires_at) > new Date(Date.now() + 60_000)) return t.access_token;
  if (!t.refresh_token) return null;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID") || "", client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") || "",
      refresh_token: t.refresh_token, grant_type: "refresh_token",
    }),
  });
  if (!r.ok) return null;
  const d = await r.json();
  await sb.from("user_google_tokens").update({
    access_token: d.access_token, token_expires_at: new Date(Date.now() + (d.expires_in || 3600) * 1000).toISOString(),
  }).eq("user_id", GOOGLE_USER_FABRICIO);
  return d.access_token;
}

async function convidarNaLive(sb: SB, email: string, nome: string, leadId: string | null) {
  if (Date.now() > LIVE_FIM) return;
  await sb.from("black_live_convidados").upsert({ email, nome, lead_id: leadId }, { onConflict: "email", ignoreDuplicates: true });
  emSegundoPlano(sincronizarConvidadosLive(sb).catch((e) => console.error("[black-agenda] convite da live", e)));
}

// Descrição do evento da live (Fabrício, 24/11): o convite mostrava só o botão do Meet, e quem entra
// por ali não passa pelo /black/entrar (não conta em "Entrou na live"). Grava sem avisar os convidados.
const DESCRICAO_LIVE = `<b>Entre pelo link: <a href="https://unvholdings.com.br/black/entrar">unvholdings.com.br/black/entrar</a></b>

Live da Black Friday UNV com Fabrício Nunnes.
Quarta, 25/11, às 20h (horário de Brasília). A sala abre 15 minutos antes.

Nessa live eu mostro por que o seu time não bate meta sem você entrar no meio da venda, e abro a condição da Black UNV só pra quem estiver ao vivo.`;

async function descricaoLive(sb: SB) {
  const tok = await tokenGoogleFabricio(sb);
  if (!tok) return { ok: false, motivo: "sem_token_google" };
  await sincronizarConvidadosLive(sb, true); // garante o id do evento
  if (!eventoLiveId) return { ok: false, motivo: "evento_da_live_nao_achado" };
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventoLiveId}?sendUpdates=none`;
  const p = await fetch(url, { method: "PATCH", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ description: DESCRICAO_LIVE }) });
  if (!p.ok) return { ok: false, motivo: `PATCH ${p.status}: ${(await p.text()).slice(0, 200)}` };
  const ev = await p.json();
  return { ok: true, evento: ev.summary, convidados: (ev.attendees || []).length, descricao: ev.description };
}

// ── aviso individual na hora da live ────────────────────────────────────────
// Fabrício, 24/11: "enviar individualmente em quem confirmou o link da live na hora que a live começar,
// através da instância fabricio nunnes". Toda confirmação em /black/live entra em black_live_confirmados;
// das 20h às 21h do dia 25 o cron de 2 min manda no privado de cada um (até 25 por rodada, 1,5 s entre
// uma e outra, trava por linha pra nunca mandar duas vezes). Quem confirma depois das 20h recebe na
// rodada seguinte.
const AVISO_LIVE_INICIO = Date.parse("2026-11-25T20:00:00-03:00");
const AVISO_LIVE_FIM = Date.parse("2026-11-25T21:00:00-03:00");

async function registrarConfirmado(sb: SB, tel: string, nome: string, leadId: string | null) {
  const fone = tel.length <= 11 ? `55${tel}` : tel;
  await sb.from("black_live_confirmados").upsert({ telefone: fone, nome, lead_id: leadId }, { onConflict: "telefone", ignoreDuplicates: true });
}

function textoAvisoLive(nome: string) {
  const primeiro = String(nome || "").trim().split(/\s+/)[0] || "";
  return `${primeiro ? primeiro + ", começou" : "Começou"}. A live da Black UNV está no ar agora.

Entra por aqui: unvholdings.com.br/black/entrar

Fica até o final: a condição da Black UNV eu abro daqui a pouco, só pra quem está ao vivo.`;
}

async function avisarConfirmadosLive(sb: SB, simular = false) {
  const agora = Date.now();
  if (!simular && (agora < AVISO_LIVE_INICIO || agora > AVISO_LIVE_FIM)) return { ok: true, fora_da_janela: true };
  const { data: fila } = await sb.from("black_live_confirmados").select("telefone, nome").eq("aviso_status", "pendente")
    .order("criado_em", { ascending: true }).limit(simular ? 1000 : 25);
  if (simular) return { ok: true, simulacao: true, pendentes: (fila || []).length, exemplo: textoAvisoLive((fila || [])[0]?.nome || "Fulano") };
  const { data: inst } = await sb.from("whatsapp_instances").select("instance_name, api_url, api_key").eq("instance_name", INSTANCIA).maybeSingle();
  if (!inst?.api_url) return { ok: false, motivo: "instancia" };
  let enviados = 0;
  for (const c of (fila || []) as any[]) {
    const { data: trava } = await sb.from("black_live_confirmados").update({ aviso_status: "enviando" })
      .eq("telefone", c.telefone).eq("aviso_status", "pendente").select("telefone");
    if (!trava?.length) continue;
    try {
      const r = await fetch(`${String(inst.api_url).replace(/\/+$/, "")}/message/sendText/${inst.instance_name}`, {
        method: "POST", headers: { apikey: inst.api_key, "Content-Type": "application/json" },
        body: JSON.stringify({ number: c.telefone, text: textoAvisoLive(c.nome) }),
      });
      await sb.from("black_live_confirmados").update(r.ok
        ? { aviso_status: "enviado", aviso_em: new Date().toISOString(), aviso_erro: null }
        : { aviso_status: "erro", aviso_erro: `HTTP ${r.status}: ${(await r.text()).slice(0, 150)}` }).eq("telefone", c.telefone);
      if (r.ok) enviados++;
    } catch (e) {
      await sb.from("black_live_confirmados").update({ aviso_status: "erro", aviso_erro: String(e).slice(0, 150) }).eq("telefone", c.telefone);
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
  return { ok: true, enviados };
}

async function meetAberto(sb: SB, soVer = false) {
  const tok = await tokenGoogleFabricio(sb);
  if (!tok) return { ok: false, motivo: "sem_token_google" };
  const H = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" };
  const code = MEET_LIVE.split("/").pop();
  const g = await fetch(`https://meet.googleapis.com/v2/spaces/${code}`, { headers: H });
  const esp = await g.json().catch(() => ({}));
  if (!g.ok) return { ok: false, motivo: `GET ${g.status}`, detalhe: JSON.stringify(esp).slice(0, 300) };
  if (soVer) return { ok: true, espaco: esp };
  const p = await fetch(`https://meet.googleapis.com/v2/${esp.name}?updateMask=config.accessType,config.moderationRestrictions.presentRestriction`, {
    method: "PATCH", headers: H, body: JSON.stringify({ config: { accessType: "OPEN", moderationRestrictions: { presentRestriction: "HOSTS_ONLY" } } }),
  });
  const d = await p.json().catch(() => ({}));
  return { ok: p.ok, status: p.status, config: d?.config || d };
}

async function ofertaPrivado(sb: SB, simular: boolean) {
  const { data: membros } = await sb.from("black_grupo_membros").select("lead_id, telefone").eq("no_grupo", true).not("lead_id", "is", null);
  const ids = [...new Set((membros || []).map((m: any) => m.lead_id))];
  const { data: leads } = await sb.from("crm_leads").select("id, name, phone, stage_id").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const { data: ja } = await sb.from("black_oferta_privado").select("lead_id");
  const feitos = new Set((ja || []).map((x: any) => x.lead_id));
  const pular = ["5531989840003", "553194622556", "5517992061688"];
  const alvo = (leads || []).filter((l: any) => l.stage_id !== ETAPA.ganho && !feitos.has(l.id) && l.phone && !pular.includes(String(l.phone).replace(/\D/g, "")));
  if (simular) return { ok: true, simulacao: true, total: alvo.length, nomes: alvo.map((l: any) => l.name) };
  let enviados = 0; const erros: string[] = [];
  for (const l of alvo as any[]) {
    const pn = /^grupo black|@|\d/i.test(String(l.name || "")) ? "" : primeiroNome(l.name);
    const texto = `Oi${pn ? `, ${pn}` : ""}! Aqui é o Ricardo, da UNV.\n\nVi que você está no grupo da Black Friday UNV e quis te chamar direto, porque a condição fecha hoje às 23h59 e sobraram só 3 vagas.\n\nPor R$ 2.000 por mês você tem diretor comercial na rotina do seu time, treinamento dos vendedores, processos comerciais implementados e gestão de tráfego pago, com o CRM da UNV de bônus. Separado, isso sai R$ 6.500 por mês.\n\nPra garantir a sua vaga: unvholdings.com.br/black/garantir\n\nSe tiver qualquer dúvida, me responde aqui que eu te ajudo agora.`;
    const { error: trava } = await sb.from("black_oferta_privado").insert({ lead_id: l.id, telefone: l.phone });
    if (trava) continue;
    try {
      const r = await abrirConversa(sb, { id: l.id, phone: l.phone }, texto);
      if (!r.ok || r.erro) { erros.push(`${l.name}: ${r.erro || "falha"}`); await sb.from("black_oferta_privado").update({ erro: String(r.erro || "falha").slice(0, 200) }).eq("lead_id", l.id); }
      else enviados++;
    } catch (e) { erros.push(`${l.name}: ${String(e).slice(0, 80)}`); }
    await new Promise((res) => setTimeout(res, 1800));
  }
  return { ok: true, enviados, erros };
}

async function limparTesteLive(sb: SB) {
  const teste = (e: string) => /^fabricio\+teste[^@]*@universidadevendas\.com\.br$/i.test(e);
  const tok = await tokenGoogleFabricio(sb);
  if (!tok) return { ok: false, motivo: "sem_token_google" };
  await sincronizarConvidadosLive(sb, true); // garante o id do evento
  if (!eventoLiveId) return { ok: false, motivo: "evento_da_live_nao_achado" };
  const H = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" };
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventoLiveId}`;
  const ev = await (await fetch(url, { headers: H })).json();
  const ficam = ((ev.attendees || []) as any[]).filter((a) => !teste(String(a.email || "")));
  const p = await fetch(`${url}?sendUpdates=none`, { method: "PATCH", headers: H, body: JSON.stringify({ attendees: ficam }) });
  if (!p.ok) return { ok: false, motivo: `PATCH ${p.status}` };
  await sb.from("black_live_convidados").delete().like("email", "fabricio+teste%@universidadevendas.com.br");
  return { ok: true, removidos: (ev.attendees || []).length - ficam.length, ficaram: ficam.length };
}

async function sincronizarConvidadosLive(sb: SB, simular = false) {
  if (Date.now() > LIVE_FIM) return { ok: true, encerrado: true };
  const { data: lista } = await sb.from("black_live_convidados").select("email").limit(3000);
  if (!lista?.length && !simular) return { ok: true, total: 0 };
  const tok = await tokenGoogleFabricio(sb);
  if (!tok) return { ok: false, motivo: "sem_token_google" };
  const H = { Authorization: `Bearer ${tok}` };
  const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  if (!eventoLiveId) {
    const r = await fetch(`${base}?timeMin=2026-11-25T21:00:00Z&timeMax=2026-11-26T02:00:00Z&singleEvents=true&maxResults=50`, { headers: H });
    if (!r.ok) return { ok: false, motivo: `lista ${r.status}` };
    const itens = ((await r.json()).items || []) as any[];
    const ev = itens.find((e) => JSON.stringify([e.hangoutLink, e.conferenceData, e.location, e.description]).includes(MEET_LIVE.split("/").pop()!));
    if (!ev) return { ok: false, motivo: "evento_da_live_nao_achado", eventos: itens.map((e) => e.summary) };
    eventoLiveId = ev.id;
  }
  const g = await fetch(`${base}/${eventoLiveId}`, { headers: H });
  if (!g.ok) { eventoLiveId = null; return { ok: false, motivo: `evento ${g.status}` }; }
  const ev = await g.json();
  const atuais = (ev.attendees || []) as any[];
  const tem = new Set(atuais.map((a) => String(a.email || "").toLowerCase()));
  const faltam: string[] = [...new Set<string>((lista || []).map((l: any) => String(l.email)))].filter((e) => !tem.has(e));
  const info = { evento: ev.summary, inicio: ev.start?.dateTime, convidados_no_evento: atuais.length, faltam: faltam.length,
    ve_os_outros: ev.guestsCanSeeOtherGuests !== false };
  if (simular) return { ok: true, simulacao: true, ...info };
  if (faltam.length || ev.guestsCanSeeOtherGuests !== false || ev.guestsCanInviteOthers !== false) {
    const p = await fetch(`${base}/${eventoLiveId}?sendUpdates=all`, {
      method: "PATCH", headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({ attendees: [...atuais, ...faltam.map((email) => ({ email }))], guestsCanSeeOtherGuests: false, guestsCanInviteOthers: false }),
    });
    if (!p.ok) return { ok: false, motivo: `PATCH ${p.status}: ${(await p.text()).slice(0, 200)}` };
  }
  await sb.from("black_live_convidados").update({ no_evento: true, atualizado_em: new Date().toISOString() }).eq("no_evento", false);
  return { ok: true, ...info, adicionados: faltam.length };
}

// ── entrada no grupo pelo anúncio ───────────────────────────────────────────
// Página /black/grupo (destino dos anúncios). Cria ou atualiza o lead na Base do funil Black Friday,
// sem aviso pro comercial (é topo de funil), e devolve o convite do grupo. Com UTM/fbclid do Meta a
// trigger trg_capi_lead já manda o Lead pela CAPI com event_id <lead>:Lead, que a página repete no pixel.
const CONVITE_GRUPO = "https://chat.whatsapp.com/JXjPFsed0pk7DzBxcdKor0";

async function entrarGrupo(sb: SB, body: Record<string, unknown>) {
  const nome = String(body.nome || "").trim().slice(0, 120);
  const empresa = String(body.empresa || "").trim().slice(0, 120);
  const k = chaveTel(body.telefone);
  if (nome.length < 2 || !k) return json({ error: "dados_incompletos" }, 400);
  const tel = String(body.telefone).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  const u = (n: string) => String(body[n] || "").slice(0, 200) || null;
  const { data: cands } = await sb.from("crm_leads").select("id, phone").eq("pipeline_id", PIPELINE)
    .ilike("phone", `%${k.slice(-8)}`).order("created_at", { ascending: true }).limit(10);
  const achou: any = (cands || []).find((l: any) => chaveTel(l.phone) === k);
  if (achou) {
    if (empresa) await sb.from("crm_leads").update({ company: empresa }).eq("id", achou.id).is("company", null);
    emSegundoPlano(convidarNoPrivado(sb, { id: achou.id, phone: achou.phone || tel }, nome));
    return json({ ok: true, lead_id: achou.id, novo: false, convite: CONVITE_GRUPO });
  }
  const { data: novo, error } = await sb.from("crm_leads").insert({
    name: nome, phone: tel, company: empresa || null, pipeline_id: PIPELINE, stage_id: ETAPA.base,
    owner_staff_id: DONO_FABRICIO, entered_pipeline_at: new Date().toISOString(), urgency: "medium",
    notes: "Veio do anúncio da Black UNV e foi mandado pro grupo (/black/grupo)",
    utm_source: u("utm_source"), utm_medium: u("utm_medium"), utm_campaign: u("utm_campaign"),
    utm_content: u("utm_content"), utm_term: u("utm_term"), fbclid: u("fbclid"),
  }).select("id").single();
  if (error || !novo) return json({ ok: true, lead_id: null, novo: false, convite: CONVITE_GRUPO }); // nunca segura a pessoa fora do grupo
  emSegundoPlano(convidarNoPrivado(sb, { id: novo.id, phone: tel }, nome));
  return json({ ok: true, lead_id: novo.id, novo: true, convite: CONVITE_GRUPO });
}

// A resposta da página não espera o WhatsApp sair (o convite abre na hora)
function emSegundoPlano(p: Promise<unknown>) {
  const er = (globalThis as any).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(p.catch((e) => console.error("[black-agenda] convite", e)));
  else p.catch(() => {});
}

/** Link do grupo no privado, pelo número do Ricardo (o agente da Black atende se a pessoa responder). Uma vez por lead. */
async function convidarNoPrivado(sb: SB, lead: { id: string; phone: string }, nome: string) {
  const { data: ja } = await sb.from("black_convites").select("lead_id").eq("lead_id", lead.id).maybeSingle();
  if (ja) return;
  await sb.from("black_convites").insert({ lead_id: lead.id, telefone: lead.phone });
  const pn = primeiroNome(nome);
  const texto = `Oi${pn ? `, ${pn}` : ""}! Aqui é o Ricardo, da UNV.\n\nRecebi seu cadastro na Black Friday UNV. Esse é o link do grupo VIP, onde o Fabrício vai revelar a condição na live de quarta, 25/11, às 20h:\n${CONVITE_GRUPO}\n\nSe você já entrou, é só ignorar. Qualquer dúvida, me chama aqui.`;
  const r = await abrirConversa(sb, lead, texto);
  if (!r.ok || r.erro) await sb.from("black_convites").update({ erro: r.erro || "falha" }).eq("lead_id", lead.id);
}

// ── garantir a vaga (Pix do 1º mês) ─────────────────────────────────────────
// Página /black/garantir. Cobra o 1º mês (R$ 2.000) por Pix no Asaas principal (ASAAS_API_KEY) e
// registra em crm_lead_payments com provider_ref = id do pagamento: o asaas-webhook já cria o recebível
// pago e credita o banco quando o Pix cai. Aqui só cuidamos do funil (Forecast → Ganho) e do placar.
const ASAAS = "https://api.asaas.com/v3";
const VALOR_BLACK = 2000;
const AVISO_PLACAR = "5531989840003"; // WhatsApp do Fabrício: cada Pix pago vira aviso pro placar da live
const DONO_FABRICIO = "b1a918b1-8776-4962-898e-5d97c7cc80c1";

async function asaas(path: string, method = "GET", body?: unknown) {
  const r = await fetch(`${ASAAS}${path}`, {
    method, headers: { "Content-Type": "application/json", access_token: Deno.env.get("ASAAS_API_KEY") || "" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.errors?.[0]?.description || `Asaas HTTP ${r.status}`);
  return d;
}

const hojeBR = () => ymdBR(Date.now());

async function garantir(sb: SB, body: Record<string, unknown>) {
  const nome = String(body.nome || "").trim().slice(0, 120);
  const empresa = String(body.empresa || "").trim().slice(0, 120);
  const cidade = String(body.cidade || "").trim().slice(0, 80);
  const email = String(body.email || "").trim().slice(0, 120);
  const doc = String(body.documento || "").replace(/\D/g, "");
  const k = chaveTel(body.telefone);
  if (nome.length < 2 || !empresa || !k) return json({ error: "dados_incompletos" }, 400);
  if (doc.length !== 11 && doc.length !== 14) return json({ error: "documento_invalido" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "email_invalido" }, 400);
  const tel = String(body.telefone).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");

  // Pix ainda válido do mesmo telefone: devolve o mesmo, não cria cobrança em dobro
  const { data: aberta } = await sb.from("black_garantias").select("id, lead_id, status, pix_payload, pix_image, asaas_payment_id")
    .eq("telefone", tel).in("status", ["pendente", "pago"]).gte("criado_em", new Date(Date.now() - 6 * 3600000).toISOString())
    .order("criado_em", { ascending: false }).limit(1).maybeSingle();
  if (aberta) return json({ ok: true, id: aberta.id, lead_id: aberta.lead_id, status: aberta.status, pix: { payload: aberta.pix_payload, image: aberta.pix_image } });

  // Lead do funil Black Friday (o mesmo da base, se o telefone bater)
  const { data: cands } = await sb.from("crm_leads").select("id, phone, stage_id, notes").eq("pipeline_id", PIPELINE)
    .ilike("phone", `%${k.slice(-8)}`).order("created_at", { ascending: true }).limit(10);
  let lead: any = (cands || []).find((l: any) => chaveTel(l.phone) === k);
  if (!lead) {
    const { data: novo, error } = await sb.from("crm_leads").insert({
      name: nome, phone: tel, email, company: empresa, city: cidade || null, document: doc,
      pipeline_id: PIPELINE, stage_id: ETAPA.forecast, owner_staff_id: DONO_FABRICIO, opportunity_value: VALOR_BLACK,
      entered_pipeline_at: new Date().toISOString(), urgency: "high", notes: "Gerou o Pix da Black UNV pela página /black/garantir",
    }).select("id, phone, stage_id, notes").single();
    if (error || !novo) return json({ error: "falha_lead" }, 500);
    lead = novo;
  } else {
    const upd: Record<string, unknown> = { name: nome, email, company: empresa, document: doc, opportunity_value: VALOR_BLACK };
    if (cidade) upd.city = cidade;
    const { data: etapas } = await sb.from("crm_stages").select("id, sort_order").eq("pipeline_id", PIPELINE);
    const ordem = new Map((etapas || []).map((e: any) => [e.id, e.sort_order]));
    if ((ordem.get(lead.stage_id) ?? 0) < (ordem.get(ETAPA.forecast) ?? 9) || lead.stage_id === ETAPA.perdido) {
      Object.assign(upd, { stage_id: ETAPA.forecast, closed_at: null, loss_reason_id: null });
    }
    await sb.from("crm_leads").update(upd).eq("id", lead.id);
  }

  try {
    let customer: string | null = null;
    const achou = await asaas(`/customers?cpfCnpj=${doc}`);
    if (achou?.data?.length) customer = achou.data[0].id;
    if (!customer) customer = (await asaas("/customers", "POST", { name: doc.length === 14 ? empresa : nome, cpfCnpj: doc, email, mobilePhone: tel, company: empresa })).id;
    const { data: g } = await sb.from("black_garantias").insert({
      lead_id: lead.id, asaas_customer_id: customer, nome, empresa, cidade, telefone: tel, email, documento: doc, valor_cents: VALOR_BLACK * 100,
    }).select("id").single();
    const pag = await asaas("/payments", "POST", {
      customer, billingType: "PIX", value: VALOR_BLACK, dueDate: hojeBR(),
      description: `Black UNV: 1º mês do projeto comercial completo (${empresa})`.slice(0, 240),
      externalReference: `black:${g?.id}`,
    });
    const qr = await asaas(`/payments/${pag.id}/pixQrCode`);
    const { data: lp } = await sb.from("crm_lead_payments").insert({
      lead_id: lead.id, amount_cents: VALOR_BLACK * 100, description: `Black UNV · 1º mês · ${empresa}`, provider: "asaas",
      provider_ref: String(pag.id), url: pag.invoiceUrl || "", status: "pending", billing_type: "PIX", recurring: false, payer_email: email,
    }).select("id").single();
    await sb.from("black_garantias").update({
      asaas_payment_id: String(pag.id), lead_payment_id: lp?.id || null, pix_payload: qr?.payload || null,
      pix_image: qr?.encodedImage || null, pix_expira_em: qr?.expirationDate ? new Date(qr.expirationDate).toISOString() : null,
    }).eq("id", g?.id);
    // Fabrício, 25/11: aviso no WhatsApp dele toda vez que alguém gera o Pix, com nome, empresa e telefone
    emSegundoPlano(avisarPixGerado(sb, { nome, empresa, tel }).catch((e) => console.error("[black-agenda] aviso pix gerado", e)));
    return json({ ok: true, id: g?.id, lead_id: lead.id, status: "pendente", pix: { payload: qr?.payload || null, image: qr?.encodedImage || null }, fatura: pag.invoiceUrl || null });
  } catch (e) {
    console.error("[black-agenda] garantir", e);
    return json({ error: "falha_cobranca", detalhe: String((e as Error).message || e).slice(0, 160) }, 502);
  }
}

function foneBonito(tel: string) {
  const d = String(tel || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

async function avisarPixGerado(sb: SB, d: { nome: string; empresa: string; tel: string }) {
  const { data: inst } = await sb.from("whatsapp_instances").select("instance_name, api_url, api_key").eq("instance_name", INSTANCIA).maybeSingle();
  if (!inst?.api_url) return;
  const texto = `*PIX GERADO NA BLACK UNV*\n\nNome: ${d.nome}\nEmpresa: ${d.empresa}\nTelefone: ${foneBonito(d.tel)}\n\nAinda não pagou.`;
  await fetch(`${String(inst.api_url).replace(/\/+$/, "")}/message/sendText/${inst.instance_name}`, {
    method: "POST", headers: { apikey: inst.api_key, "Content-Type": "application/json" },
    body: JSON.stringify({ number: AVISO_PLACAR, text: texto }),
  });
}

/** Confere no Asaas e, se pagou, fecha o lead e avisa o placar. Idempotente (pago_em). */
async function conferirGarantia(sb: SB, g: any) {
  if (!g?.asaas_payment_id || g.status !== "pendente") return g?.status || "pendente";
  const p = await asaas(`/payments/${g.asaas_payment_id}`).catch(() => null);
  const st = String(p?.status || "");
  if (!["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(st)) {
    if (["OVERDUE", "DELETED", "REFUNDED"].includes(st) && Date.now() - Date.parse(g.criado_em) > 24 * 3600000) {
      await sb.from("black_garantias").update({ status: "expirado" }).eq("id", g.id).eq("status", "pendente");
    }
    return "pendente";
  }
  const { data: trava } = await sb.from("black_garantias").update({ status: "pago", pago_em: new Date().toISOString() })
    .eq("id", g.id).eq("status", "pendente").select("id");
  if (!trava?.length) return "pago";
  await sb.from("crm_leads").update({
    stage_id: ETAPA.ganho, opportunity_value: VALOR_BLACK, closed_at: new Date().toISOString(),
    owner_staff_id: CLOSER_STAFF, closer_staff_id: CLOSER_STAFF,
  }).eq("id", g.lead_id);
  try {
    const { count } = await sb.from("black_garantias").select("id", { count: "exact", head: true }).eq("status", "pago");
    const { data: inst } = await sb.from("whatsapp_instances").select("instance_name, api_url, api_key").eq("instance_name", INSTANCIA).maybeSingle();
    if (inst?.api_url) {
      const texto = `*PIX PAGO NA BLACK UNV*\n\n${g.empresa}${g.cidade ? `, de ${g.cidade}` : ""}\n${g.nome}\nTelefone: ${foneBonito(g.telefone)}\n\nGarantidas até agora: ${count ?? "?"}`;
      await fetch(`${String(inst.api_url).replace(/\/+$/, "")}/message/sendText/${inst.instance_name}`, {
        method: "POST", headers: { apikey: inst.api_key, "Content-Type": "application/json" },
        body: JSON.stringify({ number: AVISO_PLACAR, text: texto }),
      });
      await sb.from("black_garantias").update({ avisado_em: new Date().toISOString() }).eq("id", g.id);
    }
  } catch (e) { console.error("[black-agenda] aviso placar", e); }
  return "pago";
}

async function garantiaStatus(sb: SB, body: Record<string, unknown>) {
  const id = String(body.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "id_invalido" }, 400);
  const { data: g } = await sb.from("black_garantias").select("*").eq("id", id).maybeSingle();
  if (!g) return json({ error: "nao_encontrado" }, 404);
  const status = await conferirGarantia(sb, g);
  return json({ ok: true, status });
}

/** Cancela um Pix ainda não pago (dado errado na página ou teste): apaga no Asaas e marca cancelado. */
async function cancelarGarantia(sb: SB, body: Record<string, unknown>) {
  const id = String(body.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "id_invalido" }, 400);
  const { data: g } = await sb.from("black_garantias").select("*").eq("id", id).maybeSingle();
  if (!g) return json({ error: "nao_encontrado" }, 404);
  if ((await conferirGarantia(sb, g)) === "pago") return json({ error: "ja_pago" }, 409);
  if (g.asaas_payment_id) await asaas(`/payments/${g.asaas_payment_id}`, "DELETE").catch(() => null);
  await sb.from("black_garantias").update({ status: "cancelado" }).eq("id", id).eq("status", "pendente");
  if (g.lead_payment_id) await sb.from("crm_lead_payments").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", g.lead_payment_id).neq("status", "paid");
  return json({ ok: true, status: "cancelado" });
}

/** No cron: confere os Pix gerados nas últimas 48h que ainda não foram pagos (página fechada antes de pagar). */
async function conferirPendentes(sb: SB) {
  const { data } = await sb.from("black_garantias").select("*").eq("status", "pendente")
    .gte("criado_em", new Date(Date.now() - 48 * 3600000).toISOString()).not("asaas_payment_id", "is", null).limit(20);
  for (const g of data || []) await conferirGarantia(sb, g);
}

// ── mensagens agendadas do grupo ────────────────────────────────────────────
// A sequência aprovada pelo Fabrício (06/11) fica em black_grupo_agenda. O cron de 2 min manda o que
// venceu. Texto com [CAMPO] em aberto nunca sai; mensagem que perdeu a hora por mais de 60 min também
// não (não faz sentido "faltam 15 minutos" depois da live).
const ATRASO_MAX_MIN = 60;

async function enviarAgendadas(sb: SB) {
  const agora = Date.now();
  const { data: fila } = await sb.from("black_grupo_agenda").select("id, codigo, texto, envio_em")
    .eq("status", "agendada").lte("envio_em", new Date(agora).toISOString()).order("envio_em").limit(3);
  if (!fila?.length) return 0;
  const { data: inst } = await sb.from("whatsapp_instances").select("instance_name, api_url, api_key").eq("instance_name", INSTANCIA).maybeSingle();
  let n = 0;
  for (const m of fila) {
    if (agora - Date.parse(m.envio_em) > ATRASO_MAX_MIN * 60000) {
      await sb.from("black_grupo_agenda").update({ status: "atrasada", erro: "passou mais de 60 min da hora" }).eq("id", m.id);
      continue;
    }
    if (/\[[A-ZÀ-Ú ]{3,}\]/.test(m.texto)) {
      await sb.from("black_grupo_agenda").update({ status: "falta_preencher", erro: "texto com campo em aberto" }).eq("id", m.id);
      continue;
    }
    // trava antes de enviar: se o envio demorar, o próximo cron não manda de novo
    const { data: trava } = await sb.from("black_grupo_agenda").update({ status: "enviando" }).eq("id", m.id).eq("status", "agendada").select("id");
    if (!trava?.length || !inst?.api_url) continue;
    try {
      const r = await fetch(`${String(inst.api_url).replace(/\/+$/, "")}/message/sendText/${inst.instance_name}`, {
        method: "POST", headers: { apikey: inst.api_key, "Content-Type": "application/json" },
        body: JSON.stringify({ number: GRUPO, text: m.texto }),
      });
      const d = await r.json().catch(() => ({}));
      await sb.from("black_grupo_agenda").update(r.ok
        ? { status: "enviada", enviado_em: new Date().toISOString(), remote_id: d?.key?.id || null, erro: null }
        : { status: "erro", erro: `HTTP ${r.status}` }).eq("id", m.id);
      if (r.ok) n++;
    } catch (e) {
      await sb.from("black_grupo_agenda").update({ status: "erro", erro: String(e).slice(0, 200) }).eq("id", m.id);
    }
  }
  return n;
}

async function grupoSync(sb: SB) {
  const { data: inst } = await sb.from("whatsapp_instances").select("api_url, api_key").eq("instance_name", INSTANCIA).maybeSingle();
  if (!inst?.api_url) return json({ error: "instancia" }, 500);
  const r = await fetch(`${inst.api_url}/group/participants/${INSTANCIA}?groupJid=${encodeURIComponent(GRUPO)}`, { headers: { apikey: inst.api_key } });
  const d = await r.json().catch(() => ({}));
  // Resposta ruim nunca vira "todo mundo saiu"
  if (!r.ok || !Array.isArray(d.participants) || d.participants.length === 0) {
    await sb.from("black_grupo_sync").upsert({ id: 1, rodou_em: new Date().toISOString(), erro: `HTTP ${r.status}` });
    return json({ error: "evolution", status: r.status }, 502);
  }

  const { data: nossos } = await sb.from("whatsapp_instances").select("phone_number");
  const daCasa = new Set((nossos || []).map((i: any) => chaveTel(i.phone_number)).filter(Boolean));
  const presentes = new Map<string, string>();
  for (const p of d.participants) {
    const tel = String(p.phoneNumber || "").split("@")[0];
    const k = chaveTel(tel);
    if (!k || p.admin || daCasa.has(k)) continue; // time da UNV não é lead
    presentes.set(k, tel);
  }

  // Leads do funil (paginado: PostgREST corta em 1000)
  const leads: { id: string; name: string; phone: string; stage_id: string }[] = [];
  for (let de = 0; ; de += 1000) {
    const { data: pg } = await sb.from("crm_leads").select("id, name, phone, stage_id").eq("pipeline_id", PIPELINE).range(de, de + 999);
    leads.push(...(pg || []));
    if (!pg || pg.length < 1000) break;
  }
  const porChave = new Map<string, typeof leads[number]>();
  for (const l of leads) { const k = chaveTel(l.phone); if (k && !porChave.has(k)) porChave.set(k, l); }

  const { data: estado } = await sb.from("black_grupo_membros").select("chave, no_grupo");
  const estavam = new Set<string>((estado || []).filter((e: any) => e.no_grupo).map((e: any) => e.chave as string));
  const agora = new Date().toISOString();
  let entraram = 0, sairam = 0, criados = 0;

  for (const [k, tel] of presentes) {
    let lead = porChave.get(k);
    if (!lead) {
      // Entrou pelo link repassado: vira lead do funil com o nome que já tivermos dele
      const { data: outro } = await sb.from("crm_leads").select("name").ilike("phone", `%${k.slice(-8)}`)
        .order("created_at", { ascending: false }).limit(5);
      const { data: novo } = await sb.from("crm_leads").insert({
        name: outro?.[0]?.name || `Grupo Black ${tel}`, phone: tel.startsWith("55") ? tel.slice(2) : tel,
        pipeline_id: PIPELINE, stage_id: ETAPA.entrouGrupo, entered_pipeline_at: agora, urgency: "medium",
        notes: `Entrou no grupo da Black UNV sem estar na base (${agora.slice(0, 10)})`,
      }).select("id, name, phone, stage_id").single();
      if (novo) { lead = novo; porChave.set(k, novo); criados++; }
    } else if ([ETAPA.base, ETAPA.disparo, ETAPA.saiuGrupo].includes(lead.stage_id)) {
      await sb.from("crm_leads").update({ stage_id: ETAPA.entrouGrupo }).eq("id", lead.id);
      entraram++;
    }
    if (!estavam.has(k)) {
      await sb.from("black_grupo_membros").upsert({ chave: k, telefone: tel, lead_id: lead?.id || null, no_grupo: true, entrou_em: agora, saiu_em: null, atualizado_em: agora });
    }
  }

  for (const k of estavam) {
    if (presentes.has(k)) continue;
    await sb.from("black_grupo_membros").update({ no_grupo: false, saiu_em: agora, atualizado_em: agora }).eq("chave", k);
    const lead = porChave.get(k);
    // Só quem estava parado em "Entrou no grupo"; quem já aplicou ou agendou segue o caminho
    if (lead && [ETAPA.entrouGrupo, ETAPA.entrouLive].includes(lead.stage_id)) {
      await sb.from("crm_leads").update({ stage_id: ETAPA.saiuGrupo }).eq("id", lead.id);
      sairam++;
    }
  }

  const chamados = await chamarQuemNaoAgendou(sb);
  await sb.from("black_grupo_sync").upsert({ id: 1, rodou_em: agora, erro: null, participantes: presentes.size, entraram, sairam, criados });
  return json({ ok: true, participantes: presentes.size, entraram, sairam, criados, chamados });
}

// ── Follow-up de quem pediu o grupo e não entrou (16/11/2026) ───────────────
// Fabrício: "os que não entrarem no grupo é pra fazer follow up por pelo menos 3 dias".
// Quem entra aqui: lead do disparo do convite que clicou "Quero entrar no grupo" ou escreveu depois
// (black_followup_registrar), enquanto está em Base, Disparo efetuado ou Saiu do grupo.
// São 3 toques com o link: o 1º depois de 4h (em horário comercial) e os outros com 20h de intervalo.
// Com a janela de 24h do número oficial aberta, vai pela mesma conversa; fechou, vai pelo número do
// Ricardo, onde o agente da Black atende quem responder. Entrou no grupo, pediu pra parar, respondeu
// o toque ou avançou no funil: para. O follow-up do agente (crm-agent-respond) não soma em cima.
const OFICIAL = "4e80640c-35af-45d5-a836-f7d5db36def5";
const FU_HORA_INI = 9, FU_HORA_FIM = 19, FU_TOQUES = 3, FU_POR_RODADA = 6;
const FU_PRIMEIRO_MS = 4 * 3600000, FU_INTERVALO_MS = 20 * 3600000, FU_SILENCIO_MS = 3 * 3600000;
const FU_FIM = Date.parse("2026-11-25T20:00:00-03:00"); // começou a live, acabou o convite

const NOME_GENERICO = /^(a|o|dr|dra|sr|sra|proprietari[oa]|gerente|decisor|cliente|lead|contato|grupo|loja|clinica|empresa)$/i;
function nomeDePessoa(n: unknown) {
  const p = primeiroNome(n).normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!/^[A-Za-z]{3,14}$/.test(p) || NOME_GENERICO.test(p)) return "";
  const o = primeiroNome(n);
  return o === o.toUpperCase() ? o.charAt(0) + o.slice(1).toLowerCase() : o;
}

function textoFollowupGrupo(numero: number, nome: string, canal: "oficial" | "ricardo", primeiraDoRicardo: boolean, horaBR: number) {
  const oi = horaBR < 12 ? "Bom dia" : "Boa tarde";
  const comNome = nome ? `, ${nome}` : "";
  if (canal === "ricardo" && primeiraDoRicardo) {
    return `${oi}${comNome}! Aqui é o Ricardo, do time do Fabrício Nunnes, da UNV.\n\nVocê recebeu o convite do Fabrício pro grupo da Black Friday UNV e ainda não te vi por lá. O link é este\n${CONVITE_GRUPO}\n\nA live em que ele abre a condição é quarta, 25/11, às 20h, e o link da live sai só no grupo.`;
  }
  if (numero === 1) {
    return `${oi}${comNome}! Vi que você ainda não entrou no grupo da Black Friday UNV. O link é este\n${CONVITE_GRUPO}\n\nÉ só por lá que o Fabrício vai abrir a condição e as vagas.`;
  }
  if (numero === 2) {
    return `${nome ? `${nome}, passando` : "Passando"} pra lembrar do grupo da Black Friday UNV. A live em que o Fabrício abre a condição é quarta, 25/11, às 20h, e o link da live sai só lá dentro.\n${CONVITE_GRUPO}`;
  }
  return `${nome ? `${nome}, último` : "Último"} lembrete pra não te incomodar. O grupo da Black Friday UNV continua aberto neste link\n${CONVITE_GRUPO}\n\nSe não fizer mais sentido pra você, é só me avisar que eu paro por aqui.`;
}

/** Texto livre pelo número oficial (só funciona com a janela de 24h aberta) e registro no Atendimento. */
async function enviarPeloOficial(sb: SB, conversaId: string, telefone: string, texto: string) {
  const { data: inst } = await sb.from("whatsapp_official_instances").select("phone_number_id, access_token").eq("id", OFICIAL).maybeSingle();
  if (!inst?.phone_number_id || !inst?.access_token) return { ok: false, erro: "numero oficial sem token" };
  let to = String(telefone || "").replace(/\D/g, "");
  if (to && (!to.startsWith("55") || to.length < 12)) to = `55${to}`;
  const r = await fetch(`https://graph.facebook.com/v21.0/${inst.phone_number_id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${inst.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body: texto, preview_url: true } }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, erro: String(d?.error?.message || `HTTP ${r.status}`).slice(0, 200) };
  const agora = new Date().toISOString();
  await sb.from("crm_whatsapp_messages").insert({
    conversation_id: conversaId, content: texto, type: "text", direction: "outbound", status: "sent",
    remote_id: d?.messages?.[0]?.id || null, is_ai: true, sent_by: null,
  });
  await sb.from("crm_whatsapp_conversations").update({ last_message: texto.slice(0, 255), last_message_at: agora, last_message_direction: "outbound" }).eq("id", conversaId);
  return { ok: true };
}

async function followupGrupo(sb: SB, simular = false) {
  const registrados = simular ? 0 : ((await sb.rpc("black_followup_registrar")).data ?? 0);
  const br = new Date(Date.now() - 3 * 3600000);
  const hora = br.getUTCHours(), dow = br.getUTCDay(), ymd = br.toISOString().slice(0, 10);
  const foraDeHora = dow === 0 || FERIADOS.has(ymd) || hora < FU_HORA_INI || hora >= FU_HORA_FIM || (dow === 6 && hora >= 13);
  if (Date.now() >= FU_FIM) return { registrados, enviados: 0, motivo: "live já começou" };
  if (foraDeHora && !simular) return { registrados, enviados: 0, motivo: "fora do horário (seg a sex 9h às 19h, sábado até 13h)" };

  const { data: fila } = await sb.from("black_followup_grupo").select("*").is("encerrado_em", null).lt("toques", FU_TOQUES).order("pediu_em").limit(80);
  const detalhe: string[] = [];
  let enviados = 0;
  for (const f of fila || []) {
    if (enviados >= FU_POR_RODADA) break;
    const agora = new Date().toISOString();
    const encerrar = async (motivo: string) => {
      detalhe.push(`${f.lead_id}: encerrado (${motivo})`);
      if (!simular) await sb.from("black_followup_grupo").update({ encerrado_em: agora, motivo_encerramento: motivo }).eq("lead_id", f.lead_id);
    };
    const base = Date.parse(f.ultimo_toque_em || f.pediu_em);
    if (!simular && Date.now() - base < (f.toques === 0 ? FU_PRIMEIRO_MS : FU_INTERVALO_MS)) continue;

    const { data: lead } = await sb.from("crm_leads").select("id, name, phone, stage_id, pipeline_id").eq("id", f.lead_id).maybeSingle();
    if (!lead) { await encerrar("lead não existe mais"); continue; }
    if (lead.pipeline_id !== PIPELINE) { await encerrar("saiu do funil da Black"); continue; }
    if (lead.stage_id === ETAPA.perdido) { await encerrar("lead perdido"); continue; }
    if (![ETAPA.base, ETAPA.disparo, ETAPA.saiuGrupo].includes(lead.stage_id)) { await encerrar("entrou no grupo ou avançou no funil"); continue; }
    const k = chaveTel(lead.phone || f.telefone);
    if (k) {
      const { data: m } = await sb.from("black_grupo_membros").select("no_grupo").eq("chave", k).maybeSingle();
      if (m?.no_grupo) { await encerrar("já está no grupo"); continue; }
    }
    const { data: ov } = await sb.from("crm_ai_agent_conversation_overrides").select("enabled").eq("conversation_id", f.conversa_oficial).eq("channel", "whatsapp").maybeSingle();
    if (ov && ov.enabled === false) { await encerrar("agente desligado na conversa (pediu pra parar, recusou ou alguém do time assumiu)"); continue; }
    const { data: cv } = await sb.from("crm_whatsapp_conversations").select("id, last_inbound_at, last_message_at, contact:crm_whatsapp_contacts(phone)").eq("id", f.conversa_oficial).maybeSingle();
    if (!cv) { await encerrar("conversa não encontrada"); continue; }
    const ultIn = Date.parse(String(cv.last_inbound_at || "")) || 0;
    const ultMsg = Date.parse(String(cv.last_message_at || "")) || 0;
    // respondeu depois de um toque: a conversa voltou pro agente, que segue com o follow-up normal dele
    if (f.toques > 0 && f.ultimo_toque_em) {
      const desde = Date.parse(f.ultimo_toque_em);
      let respondeu = ultIn > desde;
      if (!respondeu) {
        const { data: noRicardo } = await sb.from("crm_whatsapp_conversations").select("last_inbound_at").eq("instance_id", INSTANCIA_CLOSER).eq("lead_id", f.lead_id).gt("last_inbound_at", f.ultimo_toque_em).limit(1);
        respondeu = !!noRicardo?.length;
      }
      if (respondeu) { await encerrar("respondeu ao follow-up, o agente segue a conversa"); continue; }
    }
    // conversa em andamento agora: espera esfriar
    if (!simular && Date.now() - ultMsg < FU_SILENCIO_MS) continue;

    const numero = f.toques + 1;
    const janelaAberta = !!ultIn && Date.now() - ultIn < 23.5 * 3600000;
    let canal: "oficial" | "ricardo" = janelaAberta ? "oficial" : "ricardo";
    const nome = nomeDePessoa(lead.name);
    const telefone = String(cv.contact?.phone || lead.phone || f.telefone || "");
    if (simular) {
      detalhe.push(`${lead.name}: toque ${numero} pelo ${canal === "oficial" ? "número oficial" : "número do Ricardo"} → ${textoFollowupGrupo(numero, nome, canal, f.ultimo_canal !== "ricardo", hora).replace(/\n+/g, " / ")}`);
      enviados++;
      continue;
    }
    // marca antes de enviar (e só segue quem conseguiu marcar): se travar no meio, não manda duas vezes
    const { data: marcou } = await sb.from("black_followup_grupo").update({ toques: numero, ultimo_toque_em: agora, ultimo_canal: canal, erro: null })
      .eq("lead_id", f.lead_id).eq("toques", f.toques).is("encerrado_em", null).select("lead_id");
    if (!marcou?.length) continue;
    let r: { ok: boolean; erro?: string } = { ok: false };
    if (canal === "oficial") {
      r = await enviarPeloOficial(sb, cv.id, telefone, textoFollowupGrupo(numero, nome, "oficial", false, hora));
      if (!r.ok) canal = "ricardo"; // a janela fechou no caminho
    }
    if (canal === "ricardo") {
      const ab = await abrirConversa(sb, { id: lead.id, phone: lead.phone || telefone }, textoFollowupGrupo(numero, nome, "ricardo", f.ultimo_canal !== "ricardo", hora));
      r = { ok: !!ab.ok, erro: ab.erro };
    }
    await sb.from("black_followup_grupo").update({ ultimo_canal: canal, erro: r.ok ? (r.erro || null) : (r.erro || "falha no envio") }).eq("lead_id", f.lead_id);
    if (r.ok) {
      enviados++;
      detalhe.push(`${lead.name}: toque ${numero} enviado pelo ${canal}`);
      await sb.from("crm_ai_agent_runs").insert({ agent_id: AGENTE, channel: "whatsapp", conversation_id: cv.id, mode: "black_followup", outcome: `sent (follow-up do grupo ${numero}/${FU_TOQUES}, ${canal})` }).then(() => {}, () => {});
    } else {
      detalhe.push(`${lead.name}: toque ${numero} falhou (${r.erro || "?"})`);
      if (r.erro === "sem_whatsapp") await encerrar("número sem WhatsApp");
    }
    if (numero >= FU_TOQUES && r.ok) await sb.from("black_followup_grupo").update({ encerrado_em: agora, motivo_encerramento: "3 toques enviados" }).eq("lead_id", f.lead_id);
  }
  return { registrados, enviados, detalhe };
}

/** Aplicou e não marcou na página: depois de 15 min o Ricardo chama no WhatsApp e o agente segue. */
async function chamarQuemNaoAgendou(sb: SB) {
  const horaBR = new Date(Date.now() - 3 * 3600000).getUTCHours();
  if (horaBR < CONTATO_HORA_INI || horaBR >= CONTATO_HORA_FIM) return 0;
  const limite = new Date(Date.now() - CONTATO_APOS_MIN * 60000).toISOString();
  const { data: leads } = await sb.from("crm_leads").select("id, name, phone, company, stage_entered_at")
    .eq("pipeline_id", PIPELINE).eq("stage_id", ETAPA.aplicou).lte("stage_entered_at", limite).limit(20);
  if (!leads?.length) return 0;
  const { data: ja } = await sb.from("black_contatos").select("lead_id").in("lead_id", leads.map((l: any) => l.id));
  const feitos = new Set((ja || []).map((x: any) => x.lead_id));
  let n = 0;
  for (const lead of leads) {
    if (feitos.has(lead.id) || !lead.phone) continue;
    const { data: reuniao } = await sb.from("crm_activities").select("id").eq("lead_id", lead.id).eq("type", "meeting")
      .not("status", "in", "(cancelled,canceled,no_show)").gte("scheduled_at", new Date().toISOString()).limit(1).maybeSingle();
    if (reuniao) continue;
    // marca antes de enviar: se o envio travar no meio, não manda duas vezes
    await sb.from("black_contatos").upsert({ lead_id: lead.id, tipo: "aplicou", enviado_em: new Date().toISOString() });
    const nome = primeiroNome(lead.name);
    const empresa = lead.company && !/^@/.test(lead.company) ? ` da ${lead.company}` : "";
    const texto = `Oi${nome ? `, ${nome}` : ""}! Aqui é o Ricardo, da UNV.\n\nRecebi sua aplicação pra Black UNV. O próximo passo pra garantir sua vaga é a nossa conversa de 1 hora, onde eu olho o cenário${empresa} e te mostro como o projeto funcionaria aí.\n\nTenho horário nos próximos dias. Pra você fica melhor de manhã ou à tarde?`;
    const r = await abrirConversa(sb, lead, texto);
    if (!r.ok || r.erro) await sb.from("black_contatos").update({ erro: r.erro || "falha" }).eq("lead_id", lead.id);
    if (r.ok) n++;
  }
  return n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    switch (body.action) {
      case "aplicou": return await aplicou(sb, body);
      case "horarios": return await horarios(sb, body);
      case "agendar": return await agendar(sb, body);
      case "grupo-sync": {
        // a agenda do grupo não pode depender da leitura de participantes dar certo
        try { await enviarAgendadas(sb); } catch (e) { console.error("[black-agenda] agenda", e); }
        try { await conferirPendentes(sb); } catch (e) { console.error("[black-agenda] pix pendentes", e); }
        try { await sincronizarConvidadosLive(sb); } catch (e) { console.error("[black-agenda] convite da live", e); }
        try { await avisarConfirmadosLive(sb); } catch (e) { console.error("[black-agenda] aviso da live no privado", e); }
        const resp = await grupoSync(sb);
        // follow-up de quem pediu o grupo e não entrou: depois da leitura dos participantes, a cada 10 min
        if (new Date().getUTCMinutes() % 10 < 2) {
          try { await followupGrupo(sb); } catch (e) { console.error("[black-agenda] follow-up do grupo", e); }
        }
        return resp;
      }
      // prévia do follow-up do grupo: não envia nem grava nada
      case "followup-grupo-previa": return json(await followupGrupo(sb, true));
      case "entrou-live": return await entrouLive(sb, body);
      // conferência do convite da live sem gravar nada (lê o evento e diz quantos faltam)
      case "convidados-live-previa": return json(await sincronizarConvidadosLive(sb, true));
      // tira do evento só os e-mails de teste (fabricio+teste...), sem avisar ninguém
      case "limpar-teste-live": return json(await limparTesteLive(sb));
      case "descricao-live": return json(await descricaoLive(sb));
      // sala do Meet da live aberta: quem tem o link entra sem pedir (Fabrício, 25/11)
      case "meet-aberto": return json(await meetAberto(sb, body.ver === true));
      // oferta no privado, pelo Ricardo, pra quem está no grupo (Fabrício, 25/11 noite); {"simular":true} só lista
      case "oferta-privado": return json(await ofertaPrivado(sb, body.simular === true));
      // prévia do aviso individual das 20h: não envia nada
      case "aviso-live-previa": return json(await avisarConfirmadosLive(sb, true));
      // manda um aviso de "Pix gerado" de exemplo só pro WhatsApp do Fabrício
      case "aviso-pix-teste": await avisarPixGerado(sb, { nome: "Teste do aviso", empresa: "Empresa Exemplo", tel: "31999999999" }); return json({ ok: true });
      // manda o aviso das 20h só pro WhatsApp do Fabrício, pra ele ver como chega
      case "aviso-live-teste": {
        const { data: inst } = await sb.from("whatsapp_instances").select("instance_name, api_url, api_key").eq("instance_name", INSTANCIA).maybeSingle();
        const r = await fetch(`${String(inst?.api_url || "").replace(/\/+$/, "")}/message/sendText/${inst?.instance_name}`, {
          method: "POST", headers: { apikey: inst?.api_key, "Content-Type": "application/json" },
          body: JSON.stringify({ number: AVISO_PLACAR, text: textoAvisoLive("Fabrício") }),
        });
        return json({ ok: r.ok, status: r.status });
      }
      case "confirmou-live": return await confirmouLive(sb, body);
      case "entrar-grupo": return await entrarGrupo(sb, body);
      case "garantir": return await garantir(sb, body);
      case "garantia-status": return await garantiaStatus(sb, body);
      case "cancelar-garantia": return await cancelarGarantia(sb, body);
      default: return json({ error: "acao_invalida" }, 400);
    }
  } catch (e) {
    console.error("[black-agenda]", e);
    return json({ error: "erro_interno" }, 500);
  }
});
