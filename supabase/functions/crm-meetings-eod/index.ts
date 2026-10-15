import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * crm-meetings-eod — Fechamento diário das reuniões do CRM Comercial (cron 20:00 BRT).
 *
 * Para cada reunião do dia (pendente, ou já finalizada sem transcrição):
 *  1. Busca gravação e transcrição do Meet (anexos do evento no Calendar → fallback busca no Drive)
 *  2. Importa a transcrição para crm_transcriptions (aba Transcrição do lead) + gera briefing IA
 *  3. Sem transcrição do Meet: a gravação entra na fila (transcript_file_id) e a fase "collect"
 *     (cron a cada 10 min) manda pra AssemblyAI, colhe o texto e gera o briefing
 *  4. Vincula a gravação (recording_url) e finaliza a atividade (status=completed)
 *
 * Suporta ?dry=1 para simular sem gravar nada.
 */

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  webViewLink?: string;
}

const parseSubtitleToText = (content: string): string => {
  const lines = content.split("\n");
  const textLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === "WEBVTT") continue;
    if (/^\d+$/.test(trimmed)) continue;
    if (/-->/.test(trimmed)) continue;
    if (/^NOTE/.test(trimmed)) continue;
    if (/^STYLE/.test(trimmed)) continue;
    if (/^Kind:/.test(trimmed)) continue;
    if (/^Language:/.test(trimmed)) continue;
    const cleanLine = trimmed.replace(/<[^>]*>/g, "");
    if (cleanLine) textLines.push(cleanLine);
  }
  return textLines.join("\n");
};

const TRANSCRIPT_NAME_RE = /(transcri|transcript|gemini|anota)/i;

// Resumo do fechamento vai só pro Fabrício (mesmo número do alerta de inbox mudo)
const FABRICIO_PHONE = "5531989840003";

// Envia via function evolution-api (abstrai Stevo/Evolution conforme o provider da instância)
// deno-lint-ignore no-explicit-any
async function sendWhatsApp(supabase: any, phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  try {
    // Esta mensagem é oficial: SEMPRE sai do número do Fabrício ou do Marcelo,
    // nunca de uma instância de vendedor. Respeita a config só se ela apontar pra
    // uma instância permitida; senão força fabricionunnes → marceloalmeida.
    const ALLOWED = ["fabricionunnes", "marceloalmeida"];
    const { data: config } = await supabase
      .from("whatsapp_default_config")
      .select("setting_value")
      .eq("setting_key", "default_instance")
      .maybeSingle();
    const configured = config?.setting_value;
    const preferred = ALLOWED.includes(configured) ? configured : "fabricionunnes";
    const order = [preferred, ...ALLOWED.filter((n) => n !== preferred)];

    const { data: allowedInstances } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, provider_type, api_url, api_key, status")
      .in("instance_name", ALLOWED)
      .eq("status", "connected");
    const instance = order
      .map((name) => (allowedInstances || []).find((i: any) => i.instance_name === name))
      .find(Boolean);
    if (!instance) return { ok: false, error: "nenhuma instância oficial (Fabrício/Marcelo) conectada" };

    const apiUrl = (instance.api_url || Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
    const apiKey = instance.api_key || Deno.env.get("EVOLUTION_API_KEY");
    if (!apiUrl || !apiKey) return { ok: false, error: "sem credenciais da instância" };

    // Stevo (manager_v2) usa /send/text; Evolution padrão usa /message/sendText/{instância}
    const isManagerV2 = instance.provider_type === "manager_v2";
    const endpoint = isManagerV2 ? `${apiUrl}/send/text` : `${apiUrl}/message/sendText/${instance.instance_name}`;
    const headers: HeadersInit = isManagerV2
      ? { "Content-Type": "application/json", apikey: apiKey }
      : { "Content-Type": "application/json", apikey: apiKey, Authorization: `Bearer ${apiKey}` };
    const payload = isManagerV2 ? { number: phone, text: message, delay: 0 } : { number: phone, text: message };

    const resp = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(payload) });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[crm-meetings-eod] envio ${resp.status}: ${errText.substring(0, 300)}`);
      return { ok: false, error: `HTTP ${resp.status}: ${errText.substring(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[crm-meetings-eod] WhatsApp falhou:", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const assemblyAiKey = Deno.env.get("ASSEMBLYAI_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // ?probe=1: testa a chave da AssemblyAI com um áudio público curto e devolve a resposta crua
    // ?probe=openai&url=<áudio>: testa o Whisper (a outra transcrição usada pelo agente)
    if (new URL(req.url).searchParams.get("probe") === "openai") {
      const audioUrl = new URL(req.url).searchParams.get("url") || "";
      const a = await fetch(audioUrl);
      const blob = await a.blob();
      const form = new FormData();
      form.append("file", blob, "audio.ogg");
      form.append("model", "whisper-1");
      const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY") || ""}` }, body: form,
      });
      const t = await r.text();
      return new Response(JSON.stringify({ status: r.status, body: t.slice(0, 500) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new URL(req.url).searchParams.get("probe") === "1") {
      const r = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST",
        headers: { Authorization: assemblyAiKey || "", "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url: "https://assembly.ai/wildfires.mp3", language_code: "pt", speaker_labels: true }),
      });
      const t = await r.text();
      return new Response(JSON.stringify({ status: r.status, body: t.slice(0, 800), key: !!assemblyAiKey }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* cron chama sem body */ }
    const dryRun = url.searchParams.get("dry") === "1" || body.dry === true;
    // phase: "process" (20h, finaliza+transcreve, sem WhatsApp) | "report" (20h30, só o resumo) | ausente = tudo
    const phase = url.searchParams.get("phase") || (typeof body.phase === "string" ? body.phase : null);

    // Janela: hoje em BRT (UTC-3), do início do dia até agora.
    // ?day=YYYY-MM-DD processa um dia específico (testes / reprocessamento manual)
    const now = new Date();
    const brtNow = new Date(now.getTime() - 3 * 3600 * 1000);
    const dayOverride = url.searchParams.get("day") || (typeof body.day === "string" ? body.day : null);
    const dayStr = dayOverride && /^\d{4}-\d{2}-\d{2}$/.test(dayOverride)
      ? dayOverride
      : brtNow.toISOString().split("T")[0];
    const dayStartUtc = `${dayStr}T03:00:00.000Z`; // 00:00 BRT
    const dayEndUtc = new Date(new Date(dayStartUtc).getTime() + 24 * 3600 * 1000).toISOString();
    const windowEndUtc = now.toISOString() < dayEndUtc ? now.toISOString() : dayEndUtc;

    console.log(`[crm-meetings-eod] dia=${dayStr} dry=${dryRun} phase=${phase || "full"}`);

    // deno-lint-ignore no-explicit-any
    let meetings: any[] = [];
    if (phase !== "report" && phase !== "collect") {
      // Pendentes + finalizadas do dia: quem finaliza a reunião na mão antes das 20h também
      // tem que ganhar a transcrição (antes só as pendentes entravam)
      const { data: meetingsData, error: meetingsError } = await supabase
        .from("crm_activities")
        .select(`
          id, lead_id, title, scheduled_at, status, notes, meeting_link,
          google_calendar_event_id, google_calendar_user_id, responsible_staff_id, recording_url,
          transcript_file_id, transcript_job_id,
          lead:lead_id (id, name, company)
        `)
        .eq("type", "meeting")
        .in("status", ["pending", "completed"])
        .gte("scheduled_at", dayStartUtc)
        .lte("scheduled_at", windowEndUtc)
        .order("scheduled_at");

      if (meetingsError) throw meetingsError;
      // finalizada só entra se ainda não tem transcrição automática nem está na fila
      const finalizadas = (meetingsData || []).filter((m) => m.status === "completed" && !m.transcript_file_id);
      const jaTem = new Set<string>();
      if (finalizadas.length) {
        // qualquer transcrição do lead feita a partir do dia da reunião (inclusive a colada na mão)
        const { data: tr } = await supabase.from("crm_transcriptions").select("lead_id")
          .in("lead_id", finalizadas.map((m) => m.lead_id).filter(Boolean))
          .or(`recorded_at.gte.${dayStartUtc},created_at.gte.${dayStartUtc}`);
        for (const t of tr || []) jaTem.add(t.lead_id);
      }
      meetings = (meetingsData || []).filter((m) => m.status === "pending" ||
        (!m.transcript_file_id && !m.transcript_job_id && !jaTem.has(m.lead_id)));
    }
    console.log(`[crm-meetings-eod] ${meetings.length} reuniões do dia pra fechar/transcrever`);

    // Resolve fallback de usuário Google via staff responsável
    const staffIds = [...new Set(meetings.filter((m) => !m.google_calendar_user_id && m.responsible_staff_id).map((m) => m.responsible_staff_id))];
    const staffUserMap = new Map<string, string>();
    if (staffIds.length > 0) {
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id, user_id")
        .in("id", staffIds);
      for (const s of staff || []) {
        if (s.user_id) staffUserMap.set(s.id, s.user_id);
      }
    }

    // Tokens Google por usuário (com refresh)
    const tokenCache = new Map<string, string | null>();
    const getAccessToken = async (userId: string): Promise<string | null> => {
      if (tokenCache.has(userId)) return tokenCache.get(userId)!;
      const { data: tokenData } = await supabase
        .from("user_google_tokens")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (!tokenData) { tokenCache.set(userId, null); return null; }

      let accessToken: string | null = tokenData.access_token;
      if (tokenData.token_expires_at && new Date(tokenData.token_expires_at) < new Date()) {
        accessToken = null;
        if (googleClientId && googleClientSecret && tokenData.refresh_token) {
          const resp = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: googleClientId,
              client_secret: googleClientSecret,
              refresh_token: tokenData.refresh_token,
              grant_type: "refresh_token",
            }),
          });
          if (resp.ok) {
            const refreshData = await resp.json();
            accessToken = refreshData.access_token;
            await supabase
              .from("user_google_tokens")
              .update({
                access_token: accessToken,
                token_expires_at: new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString(),
              })
              .eq("user_id", userId);
          }
        }
      }
      tokenCache.set(userId, accessToken);
      return accessToken;
    };

    // Busca no Drive por usuário (cache) — arquivos de hoje
    const driveCache = new Map<string, DriveFile[]>();
    const getDriveFiles = async (userId: string, accessToken: string): Promise<DriveFile[]> => {
      if (driveCache.has(userId)) return driveCache.get(userId)!;
      // Google nomeia gravações como "<evento> ... - Recording" (antes era "Meet Recording") e "Gravação" em pt
      const recordingsQuery = "mimeType='video/mp4' and (name contains 'Recording' or name contains 'Gravação' or name contains 'gravação')";
      const subtitleQuery = "(mimeType='text/vtt' or mimeType='text/plain' or mimeType='application/x-subrip') and (name contains 'transcript' or name contains 'Transcript' or name contains 'transcrição' or name contains 'Transcrição')";
      const docsQuery = "mimeType='application/vnd.google-apps.document' and (name contains 'Transcript' or name contains 'Transcrição' or name contains 'Gemini' or name contains 'Anotações')";
      const combined = `((${recordingsQuery}) or (${subtitleQuery}) or (${docsQuery})) and createdTime >= '${dayStartUtc}'`;
      const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(combined)}&fields=files(id,name,createdTime,webViewLink,mimeType)&orderBy=createdTime desc&pageSize=100`;
      try {
        const resp = await fetch(driveUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!resp.ok) {
          console.log(`[crm-meetings-eod] Drive API erro para user ${userId}: ${resp.status}`);
          driveCache.set(userId, []);
          return [];
        }
        const data = await resp.json();
        const files = (data.files || []) as DriveFile[];
        driveCache.set(userId, files);
        return files;
      } catch (e) {
        console.error(`[crm-meetings-eod] Drive fetch falhou:`, e);
        driveCache.set(userId, []);
        return [];
      }
    };

    const downloadTranscriptText = async (file: DriveFile, accessToken: string): Promise<string | null> => {
      try {
        const dlUrl = file.mimeType === "application/vnd.google-apps.document"
          ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`
          : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
        const resp = await fetch(dlUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!resp.ok) return null;
        const content = await resp.text();
        const text = /-->/m.test(content) ? parseSubtitleToText(content) : content.trim();
        return text.length > 50 ? text : null;
      } catch {
        return null;
      }
    };

    // Upload em streaming do Drive pra AssemblyAI (webContentLink não funciona pra arquivo privado).
    // Só SUBMETE: a gravação de 1h leva uns 10 min pra transcrever, então o texto é colhido
    // depois pela fase "collect" (cron a cada 10 min). Antes esperava 4 min aqui e desistia.
    type Submit = { jobId: string } | { error: string; semSaldo?: boolean; definitivo?: boolean };
    const submitToAssemblyAI = async (fileId: string, accessToken: string): Promise<Submit> => {
      if (!assemblyAiKey) return { error: "ASSEMBLYAI_API_KEY não configurada", definitivo: true };
      try {
        const metaResp = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=size`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (metaResp.status === 404) return { error: "gravação não existe mais no Drive", definitivo: true };
        const meta = metaResp.ok ? await metaResp.json() : {};
        const fileSize = parseInt(meta.size || "0");
        // AssemblyAI aceita até 2,2 GB; reunião de 1h do Meet dá uns 600 MB
        if (fileSize > 2 * 1024 * 1024 * 1024) return { error: `arquivo grande demais (${Math.round(fileSize / 1048576)} MB)`, definitivo: true };

        const fileResp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!fileResp.ok || !fileResp.body) return { error: `download do Drive falhou (${fileResp.status})` };

        const uploadResp = await fetch("https://api.assemblyai.com/v2/upload", {
          method: "POST",
          headers: { Authorization: assemblyAiKey },
          body: fileResp.body,
        });
        if (!uploadResp.ok) {
          const t = (await uploadResp.text()).slice(0, 300);
          return { error: `upload AssemblyAI ${uploadResp.status}: ${t}`, semSaldo: /balance/i.test(t) };
        }
        const { upload_url } = await uploadResp.json();

        const submitResp = await fetch("https://api.assemblyai.com/v2/transcript", {
          method: "POST",
          headers: { Authorization: assemblyAiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ audio_url: upload_url, language_code: "pt", speaker_labels: true }),
        });
        if (!submitResp.ok) {
          // o motivo vem no corpo (ex.: "account balance is negative"); sem ele o erro ficava mudo
          const t = (await submitResp.text()).slice(0, 300);
          return { error: `AssemblyAI ${submitResp.status}: ${t}`, semSaldo: /balance/i.test(t) };
        }
        const { id } = await submitResp.json();
        return id ? { jobId: id } : { error: "AssemblyAI não devolveu o id do job" };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    };

    const pollAssemblyAI = async (jobId: string): Promise<{ status: "pronto"; text: string } | { status: "processando" } | { status: "erro"; error: string }> => {
      try {
        const r = await fetch(`https://api.assemblyai.com/v2/transcript/${jobId}`, { headers: { Authorization: assemblyAiKey! } });
        if (!r.ok) return { status: "processando" };
        const d = await r.json();
        if (d.status === "completed") {
          const text = d.utterances?.length
            ? d.utterances.map((u: { speaker: string; text: string }) => `[Participante ${u.speaker}]: ${u.text}`).join("\n\n")
            : d.text || "";
          return text.length > 50 ? { status: "pronto", text } : { status: "erro", error: "áudio sem fala (transcrição vazia)" };
        }
        if (d.status === "error") return { status: "erro", error: String(d.error || "erro na AssemblyAI").slice(0, 300) };
        return { status: "processando" };
      } catch {
        return { status: "processando" };
      }
    };

    // Grava na aba Transcrição do lead + briefing IA. Não duplica (mesma origem ou mesmo horário).
    // deno-lint-ignore no-explicit-any
    const saveTranscript = async (meeting: any, text: string, sourceId: string | null): Promise<"ok" | "ja" | "erro"> => {
      const lead = meeting.lead as { name: string | null; company: string | null } | null;
      const leadName = lead?.name || "Lead";
      const { data: porOrigem } = sourceId
        ? await supabase.from("crm_transcriptions").select("id").eq("source_meeting_id", sourceId).limit(1)
        : { data: null };
      const { data: porHorario } = await supabase.from("crm_transcriptions").select("id")
        .eq("lead_id", meeting.lead_id).eq("source", "google-meet-auto").eq("recorded_at", meeting.scheduled_at).limit(1);
      if (porOrigem?.length || porHorario?.length) return "ja";

      const title = `Reunião ${new Date(meeting.scheduled_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}, ${leadName}`;
      const { data: inserted, error: insertError } = await supabase
        .from("crm_transcriptions")
        .insert({
          lead_id: meeting.lead_id,
          title,
          transcription_text: text,
          source: "google-meet-auto",
          source_meeting_id: sourceId,
          source_meeting_url: meeting.meeting_link,
          recorded_at: meeting.scheduled_at,
          language: "pt-BR",
          status: "completed",
        })
        .select("id")
        .single();
      if (insertError) {
        console.error(`[crm-meetings-eod] Erro ao inserir transcrição (lead ${meeting.lead_id}):`, insertError);
        return "erro";
      }

      // Briefing IA (best-effort)
      try {
        const briefResp = await fetch(`${supabaseUrl}/functions/v1/generate-crm-briefing`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ transcription: text, leadName, companyName: lead?.company || "" }),
        });
        if (briefResp.ok) {
          const { briefing } = await briefResp.json();
          if (briefing) await supabase.from("crm_transcriptions").update({ ai_analysis: briefing }).eq("id", inserted.id);
        } else {
          console.error(`[crm-meetings-eod] Briefing ${briefResp.status}: ${(await briefResp.text()).slice(0, 200)}`);
        }
      } catch (e) {
        console.error("[crm-meetings-eod] Briefing falhou:", e);
      }
      return "ok";
    };

    // Fase "collect" (cron a cada 10 min): fila de gravações -> AssemblyAI -> lead + briefing
    if (phase === "collect") {
      const inicio = Date.now();
      const { data: fila } = await supabase
        .from("crm_activities")
        .select(`id, lead_id, scheduled_at, notes, meeting_link, google_calendar_user_id, responsible_staff_id,
          transcript_file_id, transcript_job_id, transcript_attempts, transcript_next_try_at,
          lead:lead_id (id, name, company)`)
        .not("transcript_file_id", "is", null)
        .order("scheduled_at")
        .limit(30);
      const itens = fila || [];
      const out: Record<string, unknown>[] = [];
      const fechar = async (id: string, extra: Record<string, unknown>) =>
        await supabase.from("crm_activities").update({
          transcript_file_id: null, transcript_job_id: null, transcript_next_try_at: null, ...extra,
        }).eq("id", id);

      // 1) colhe o que já foi enviado
      for (const m of itens.filter((x) => x.transcript_job_id)) {
        const r = await pollAssemblyAI(m.transcript_job_id);
        if (r.status === "processando") { out.push({ id: m.id, status: "processando" }); continue; }
        if (r.status === "erro") {
          const tentativas = (m.transcript_attempts || 0) + 1;
          if (tentativas >= 3) await fechar(m.id, { transcript_error: r.error, transcript_attempts: tentativas });
          else await supabase.from("crm_activities").update({ transcript_job_id: null, transcript_error: r.error, transcript_attempts: tentativas }).eq("id", m.id);
          out.push({ id: m.id, status: "erro", error: r.error });
          continue;
        }
        const salvo = await saveTranscript(m, r.text, `assemblyai:${m.transcript_job_id}`);
        if (salvo === "erro") { out.push({ id: m.id, status: "erro ao gravar" }); continue; }
        const nota = "Transcrição da gravação importada para a aba Transcrição, com briefing.";
        await fechar(m.id, { transcript_error: null, notes: m.notes ? `${m.notes}\n\n${nota}` : nota });
        out.push({ id: m.id, status: salvo === "ok" ? "importada" : "já existia" });
      }

      // 2) envia as que estão na fila (uma gravação de 600 MB leva ~30 s; limite de tempo por execução)
      const pendentes = itens.filter((x) => !x.transcript_job_id &&
        (!x.transcript_next_try_at || new Date(x.transcript_next_try_at) <= new Date()));
      const semUser = pendentes.filter((x) => !x.google_calendar_user_id && x.responsible_staff_id).map((x) => x.responsible_staff_id);
      const staffUser = new Map<string, string>();
      if (semUser.length) {
        const { data: st } = await supabase.from("onboarding_staff").select("id, user_id").in("id", [...new Set(semUser)]);
        for (const x of st || []) if (x.user_id) staffUser.set(x.id, x.user_id);
      }
      for (const m of pendentes) {
        if (Date.now() - inicio > 120_000) break;
        const userId = m.google_calendar_user_id || staffUser.get(m.responsible_staff_id);
        const token = userId ? await getAccessToken(userId) : null;
        if (!token) {
          await fechar(m.id, { transcript_error: "sem acesso ao Google do responsável" });
          out.push({ id: m.id, status: "sem token Google" });
          continue;
        }
        const r = await submitToAssemblyAI(m.transcript_file_id, token);
        if ("jobId" in r) {
          await supabase.from("crm_activities").update({ transcript_job_id: r.jobId, transcript_error: null }).eq("id", m.id);
          out.push({ id: m.id, status: "enviada", job: r.jobId });
          continue;
        }
        console.log(`[crm-meetings-eod] fila ${m.id}: ${r.error}`);
        const tentativas = (m.transcript_attempts || 0) + (r.semSaldo ? 0 : 1);
        if (r.definitivo || tentativas >= 5) {
          await fechar(m.id, { transcript_error: r.error, transcript_attempts: tentativas });
        } else {
          // sem saldo: tenta de hora em hora sem gastar tentativa (volta sozinho quando recarregar)
          const espera = r.semSaldo ? 60 : 15;
          await supabase.from("crm_activities").update({
            transcript_error: r.error, transcript_attempts: tentativas,
            transcript_next_try_at: new Date(Date.now() + espera * 60_000).toISOString(),
          }).eq("id", m.id);
        }
        out.push({ id: m.id, status: "falhou", error: r.error });
        if (r.semSaldo) break; // as outras vão dar o mesmo erro
      }

      return new Response(JSON.stringify({ success: true, phase, fila: itens.length, resultados: out }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const usedFileIds = new Set<string>();

    // Arquivo cujo nome contém o título de outra reunião do dia é "dono" dela —
    // proximidade não pode roubar arquivo alheio (o Meet põe o título do evento no nome)
    const normTitle = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const allTitles = meetings
      .map((m) => ({ id: m.id as string, t: normTitle((m.title as string) || "") }))
      .filter((x) => x.t.length >= 5);
    const fileOwnerCache = new Map<string, string | null>();
    const fileOwner = (f: DriveFile): string | null => {
      if (fileOwnerCache.has(f.id)) return fileOwnerCache.get(f.id)!;
      const n = normTitle(f.name);
      let owner: string | null = null;
      let ownerLen = 0;
      for (const { id, t } of allTitles) {
        if (n.includes(t) && t.length > ownerLen) { owner = id; ownerLen = t.length; }
      }
      fileOwnerCache.set(f.id, owner);
      return owner;
    };

    const results: Record<string, unknown>[] = [];
    let finalized = 0;
    let transcriptsImported = 0;
    let recordingsLinked = 0;

    for (const meeting of meetings) {
      const lead = meeting.lead as { id: string; name: string | null; company: string | null } | null;
      const leadName = lead?.name || "Lead";
      const scheduledAt = new Date(meeting.scheduled_at);
      const result: Record<string, unknown> = {
        activity_id: meeting.id,
        lead: leadName,
        scheduled_at: meeting.scheduled_at,
        transcript: false,
        recording: false,
      };

      const googleUserId = meeting.google_calendar_user_id ||
        (meeting.responsible_staff_id ? staffUserMap.get(meeting.responsible_staff_id) : null);

      let transcriptText: string | null = null;
      let transcriptSourceId: string | null = null;
      let recordingLink: string | null = meeting.recording_url || null;
      let queueFileId: string | null = null;

      if (googleUserId) {
        const accessToken = await getAccessToken(googleUserId);
        if (accessToken) {
          // 1) Anexos do evento no Calendar (matching exato)
          let attachmentFiles: DriveFile[] = [];
          if (meeting.google_calendar_event_id) {
            try {
              const evResp = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(meeting.google_calendar_event_id)}?fields=attachments,summary`,
                { headers: { Authorization: `Bearer ${accessToken}` } },
              );
              if (evResp.ok) {
                const ev = await evResp.json();
                attachmentFiles = (ev.attachments || []).map((a: { fileId: string; title: string; mimeType: string }) => ({
                  id: a.fileId,
                  name: a.title || "",
                  mimeType: a.mimeType || "",
                  createdTime: meeting.scheduled_at,
                }));
              }
            } catch { /* segue pro fallback */ }
          }

          const attTranscript = attachmentFiles.find((f) =>
            (f.mimeType === "application/vnd.google-apps.document" || f.mimeType.startsWith("text/")) &&
            TRANSCRIPT_NAME_RE.test(f.name) && !usedFileIds.has(f.id));
          const attRecording = attachmentFiles.find((f) => f.mimeType === "video/mp4" && !usedFileIds.has(f.id));

          // 2) Fallback: busca no Drive por proximidade de horário (mesmo dia)
          let driveFiles: DriveFile[] = [];
          if (!attTranscript || !attRecording) {
            driveFiles = await getDriveFiles(googleUserId, accessToken);
          }
          const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          const pickByProximity = (files: DriveFile[]): DriveFile | null => {
            let best: DriveFile | null = null;
            let bestDiff = Infinity;
            for (const f of files) {
              if (usedFileIds.has(f.id)) continue;
              const owner = fileOwner(f);
              if (owner && owner !== meeting.id) continue;
              // arquivo do Meet é criado no FIM da gravação — nunca antes da reunião começar
              const diff = new Date(f.createdTime).getTime() - scheduledAt.getTime();
              if (diff < -5 * 60 * 1000 || diff > 10 * 3600 * 1000) continue;
              if (Math.abs(diff) < bestDiff) { bestDiff = Math.abs(diff); best = f; }
            }
            return best;
          };
          // O Meet põe o título do evento no nome do arquivo — quando bate, vale mais que
          // proximidade, mas a janela de horário SEMPRE vale (evento recorrente repete título)
          const inWindow = (f: DriveFile): boolean => {
            const diff = new Date(f.createdTime).getTime() - scheduledAt.getTime();
            return diff >= -5 * 60 * 1000 && diff <= 10 * 3600 * 1000;
          };
          const pickFile = (files: DriveFile[], title: string | null): DriveFile | null => {
            const t = norm(title || "");
            if (t.length >= 5) {
              const byName = files.filter((f) => !usedFileIds.has(f.id) && norm(f.name).includes(t) && inWindow(f));
              if (byName.length > 0) {
                let best: DriveFile | null = null;
                let bestDiff = Infinity;
                for (const f of byName) {
                  const d = Math.abs(new Date(f.createdTime).getTime() - scheduledAt.getTime());
                  if (d < bestDiff) { bestDiff = d; best = f; }
                }
                return best;
              }
            }
            return pickByProximity(files);
          };

          const transcriptFile = attTranscript ||
            pickFile(driveFiles.filter((f) => f.mimeType !== "video/mp4" && TRANSCRIPT_NAME_RE.test(f.name)), meeting.title);
          const recordingFile = attRecording ||
            pickFile(driveFiles.filter((f) => f.mimeType === "video/mp4"), meeting.title);

          if (recordingFile) {
            usedFileIds.add(recordingFile.id);
            recordingLink = recordingFile.webViewLink || `https://drive.google.com/file/d/${recordingFile.id}/view`;
          }

          if (transcriptFile) {
            transcriptText = await downloadTranscriptText(transcriptFile, accessToken);
            if (transcriptText) {
              usedFileIds.add(transcriptFile.id);
              transcriptSourceId = transcriptFile.id;
            }
          }

          // 3) Último recurso: a gravação vai pra fila da AssemblyAI (fase "collect" importa + briefing)
          if (!transcriptText && recordingFile) queueFileId = recordingFile.id;
        } else {
          result.warning = "sem token Google";
        }
      } else {
        result.warning = "sem usuário Google vinculado";
      }

      // Importa transcrição pra aba Transcrição do lead (+ briefing)
      if (transcriptText && meeting.lead_id) {
        if (dryRun) {
          result.transcript = "dry-run";
        } else {
          const salvo = await saveTranscript(meeting, transcriptText, transcriptSourceId);
          if (salvo === "ok") { transcriptsImported++; result.transcript = true; }
          else if (salvo === "ja") result.transcript = "já importada";
        }
      } else if (queueFileId && meeting.lead_id) {
        result.transcript = "na fila";
      }

      if (recordingLink && recordingLink !== meeting.recording_url) {
        result.recording = true;
        recordingsLinked++;
      }

      // Finaliza a reunião do dia
      const jaFinalizada = meeting.status === "completed";
      const autoNote = result.transcript === true || result.transcript === "já importada"
        ? "Finalizada automaticamente (20h), transcrição importada para a aba Transcrição."
        : result.transcript === "na fila"
          ? "Finalizada automaticamente (20h), gravação vinculada, transcrição em processamento (chega na aba Transcrição com briefing)."
          : recordingLink
            ? "Finalizada automaticamente (20h), gravação vinculada, sem transcrição encontrada."
            : "Finalizada automaticamente (20h), nenhuma gravação/transcrição encontrada no Google.";
      const notaFinalizada = result.transcript === true
        ? "Transcrição importada automaticamente para a aba Transcrição."
        : result.transcript === "na fila"
          ? "Gravação encontrada, transcrição em processamento (chega na aba Transcrição com briefing)."
          : null;

      // já finalizada e nada novo: não mexe (nem nota repetida)
      if (!dryRun && jaFinalizada && !notaFinalizada && recordingLink === meeting.recording_url) {
        result.note = "já finalizada, nada novo";
        results.push(result);
        continue;
      }

      if (!dryRun) {
        const nota = jaFinalizada ? notaFinalizada : autoNote;
        const { error: updError } = await supabase
          .from("crm_activities")
          .update({
            ...(jaFinalizada ? {} : { status: "completed", completed_at: now.toISOString() }),
            recording_url: recordingLink,
            ...(nota ? { notes: meeting.notes ? `${meeting.notes}\n\n${nota}` : nota } : {}),
            ...(queueFileId ? {
              transcript_file_id: queueFileId, transcript_job_id: null, transcript_attempts: 0,
              transcript_error: null, transcript_next_try_at: null,
            } : {}),
          })
          .eq("id", meeting.id);
        if (updError) {
          console.error(`[crm-meetings-eod] Erro ao finalizar atividade ${meeting.id}:`, updError);
          result.error = updError.message;
        } else if (!jaFinalizada) {
          finalized++;
        }
      }

      result.note = autoNote;
      results.push(result);
    }

    console.log(`[crm-meetings-eod] fim: ${finalized} finalizadas, ${transcriptsImported} transcrições, ${recordingsLinked} gravações`);

    // Resumo do fechamento no WhatsApp do Fabrício — lê o estado do BANCO (reflete também o que
    // o sync-all-recordings e o agente do Marcelo fizeram), por isso roda na fase "report" (20h30)
    let summaryStatus: string = "não enviado";
    if (!dryRun && phase !== "process") {
      // CRM: todas as reuniões do dia (qualquer status) + transcrições automáticas importadas hoje
      const { data: dayActs } = await supabase
        .from("crm_activities")
        .select("id, lead_id, title, scheduled_at, status, recording_url, transcript_file_id, transcript_error, lead:lead_id (id, name)")
        .eq("type", "meeting")
        .gte("scheduled_at", dayStartUtc)
        .lt("scheduled_at", dayEndUtc)
        .order("scheduled_at");
      const { data: dayTrans } = await supabase
        .from("crm_transcriptions")
        .select("lead_id")
        .eq("source", "google-meet-auto")
        .gte("recorded_at", dayStartUtc)
        .lt("recorded_at", dayEndUtc);
      const leadsComTranscricao = new Set((dayTrans || []).map((t) => t.lead_id));

      const crmActs = dayActs || [];
      const crmCompleted = crmActs.filter((a) => a.status === "completed").length;

      const { data: projNotes } = await supabase
        .from("onboarding_meeting_notes")
        .select("id, is_finalized, transcript, is_no_show")
        .gte("meeting_date", dayStartUtc)
        .lt("meeting_date", dayEndUtc);
      const projTotal = projNotes?.length || 0;
      const projFinalized = projNotes?.filter((n) => n.is_finalized).length || 0;
      const projWithTranscript = projNotes?.filter((n) => n.transcript && n.transcript.length > 50).length || 0;

      if (crmActs.length > 0 || projTotal > 0) {
        const dayBr = `${dayStr.slice(8, 10)}/${dayStr.slice(5, 7)}`;
        const lines: string[] = [`Fechamento de reuniões — ${dayBr}`];

        lines.push("");
        if (crmActs.length > 0) {
          lines.push(`CRM: ${crmActs.length} reunião(ões) do dia, ${crmCompleted} finalizada(s), ${leadsComTranscricao.size} com transcrição no lead.`);
          for (const a of crmActs) {
            const hora = new Date(a.scheduled_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
            const leadName = (a.lead as { name?: string } | null)?.name || a.title || "Lead";
            const st = a.status === "cancelled"
              ? "cancelada"
              : leadsComTranscricao.has(a.lead_id)
                ? "finalizada, transcrição no lead"
                : a.transcript_file_id
                  ? "finalizada, transcrição em processamento"
                : a.recording_url
                  ? "finalizada, gravação sem transcrição"
                  : a.status === "completed"
                    ? "finalizada, sem gravação/transcrição"
                    : "pendente";
            lines.push(`- ${hora} ${leadName}: ${st}`);
          }
          // falha da transcrição não pode ficar muda (ficou 10 dias sem saldo sem ninguém saber)
          const erroTrans = crmActs.find((a) => a.transcript_error)?.transcript_error as string | undefined;
          if (erroTrans) {
            lines.push("");
            lines.push(/balance/i.test(erroTrans)
              ? "ATENÇÃO: a AssemblyAI (transcrição das gravações) está sem saldo. Recarregue em assemblyai.com/dashboard; a fila sai sozinha depois."
              : `ATENÇÃO: transcrição automática com erro: ${erroTrans.slice(0, 160)}`);
          }
        } else {
          lines.push("CRM: nenhuma reunião no dia.");
        }

        lines.push("");
        lines.push(`Projetos: ${projTotal} reunião(ões) hoje, ${projFinalized} finalizada(s), ${projWithTranscript} com transcrição.`);

        const sent = await sendWhatsApp(supabase, FABRICIO_PHONE, lines.join("\n"));
        summaryStatus = sent.ok ? "enviado" : sent.error || "falhou";
        console.log(`[crm-meetings-eod] resumo WhatsApp ${summaryStatus}`);
      } else {
        summaryStatus = "sem reuniões no dia";
      }
    } else if (phase === "process") {
      summaryStatus = "fase process (resumo vai às 20h30)";
    }

    return new Response(
      JSON.stringify({
        success: true,
        day: dayStr,
        dryRun,
        meetings: meetings.length,
        finalized,
        transcriptsImported,
        recordingsLinked,
        whatsappSummary: summaryStatus,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[crm-meetings-eod] erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
