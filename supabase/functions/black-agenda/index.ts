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
  entrouLive: "da053c2c-5a83-4705-97da-d2cce6e61f8f",
  saiuGrupo: "bd85787b-a72c-4aec-996c-48c81ccc881b",
  aplicou: "ef2c955e-7b99-4454-993d-887d33157dc1",
  agendou: "7cdef1c1-9a3a-40f6-9ce8-482abc4b1d2a",
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
// A live é 10/11/2026 às 20h (Brasília). Conta quem passa por /black/entrar entre 19h e 23h59.
const LIVE_INI = Date.parse("2026-11-10T19:00:00-03:00");
const LIVE_FIM = Date.parse("2026-11-10T23:59:59-03:00");
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
      notes: "Entrou na live da Black UNV (10/11) sem estar na base",
    }).select("id, phone, stage_id").single();
    lead = novo;
  } else if ([ETAPA.base, ETAPA.disparo, ETAPA.entrouGrupo, ETAPA.saiuGrupo].includes(lead.stage_id)) {
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
      case "grupo-sync": return await grupoSync(sb);
      case "entrou-live": return await entrouLive(sb, body);
      default: return json({ error: "acao_invalida" }, 400);
    }
  } catch (e) {
    console.error("[black-agenda]", e);
    return json({ error: "erro_interno" }, 500);
  }
});
