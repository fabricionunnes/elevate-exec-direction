import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * sync-all-recordings — Sincroniza gravações e transcrições do Meet para as reuniões de projetos.
 * Cron diário 20:00 BRT. Centrado na REUNIÃO (não no projeto):
 *  - resolve o Drive certo por reunião: dono do calendário → staff da reunião → consultor do projeto
 *  - anexos do evento no Calendar (matching exato) → fallback Drive por proximidade de horário
 *  - transcrição: arquivo VTT/TXT/Docs do Meet → fallback AssemblyAI (upload em streaming do Drive)
 *  - finaliza a reunião com gravação e conclui a tarefa de reunião original com a transcrição dentro
 */

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  webViewLink?: string;
}

const TRANSCRIPT_NAME_RE = /(transcri|transcript|gemini|anota|notes)/i;
const MAX_ASSEMBLYAI_PER_RUN = 3;
const MAX_RECORDING_BYTES = 800 * 1024 * 1024;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const assemblyAiKey = Deno.env.get("ASSEMBLYAI_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting recordings/transcripts sync (meeting-centric)...");

    // Reuniões dos últimos 60 dias de projetos ativos que ainda precisam de algo
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
    const { data: meetingsData, error: meetingsError } = await supabase
      .from("onboarding_meeting_notes")
      .select(`
        id, meeting_title, meeting_date, subject, recording_link, transcript, transcript_job_id, is_finalized,
        notes, project_id, meeting_link, google_event_id, calendar_owner_id, staff_id, transcript_source_file_id,
        project:project_id (id, status, consultant_id)
      `)
      .gte("meeting_date", sixtyDaysAgo)
      .order("meeting_date", { ascending: false });

    if (meetingsError) throw meetingsError;

    // Todas as reuniões de projetos ativos na janela: mesmo as já completas passam pelo
    // passo da tarefa (idempotente) — só a busca de arquivos é pulada quando nada falta
    const meetings = (meetingsData || []).filter((m) => {
      const proj = m.project as { status?: string } | null;
      return !(proj && proj.status && proj.status !== "active");
    });

    console.log(`${meetings.length} meetings need sync (of ${meetingsData?.length || 0} in window)`);

    // Resolve candidatos de usuário Google por reunião: dono do calendário → staff → consultor
    const staffIds = new Set<string>();
    for (const m of meetings) {
      if (m.staff_id) staffIds.add(m.staff_id);
      const proj = m.project as { consultant_id?: string } | null;
      if (proj?.consultant_id) staffIds.add(proj.consultant_id);
    }
    const staffUserMap = new Map<string, string>();
    if (staffIds.size > 0) {
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id, user_id")
        .in("id", [...staffIds]);
      for (const s of staff || []) {
        if (s.user_id) staffUserMap.set(s.id, s.user_id);
      }
    }

    // Tokens Google (com refresh) — cache por usuário
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

    const candidateUsers = (m: (typeof meetings)[number]): string[] => {
      const users: string[] = [];
      if (m.calendar_owner_id) users.push(m.calendar_owner_id);
      if (m.staff_id && staffUserMap.get(m.staff_id)) users.push(staffUserMap.get(m.staff_id)!);
      const proj = m.project as { consultant_id?: string } | null;
      if (proj?.consultant_id && staffUserMap.get(proj.consultant_id)) users.push(staffUserMap.get(proj.consultant_id)!);
      return [...new Set(users)];
    };

    // Busca no Drive por usuário — arquivos dos últimos 60 dias (cache por usuário)
    const driveCache = new Map<string, DriveFile[]>();
    const getDriveFiles = async (userId: string, accessToken: string): Promise<DriveFile[]> => {
      if (driveCache.has(userId)) return driveCache.get(userId)!;
      // Google nomeia gravações como "<evento> ... - Recording" (antes era "Meet Recording") e "Gravação" em pt
      const recordingsQuery = "mimeType='video/mp4' and (name contains 'Recording' or name contains 'Gravação' or name contains 'gravação')";
      const subtitleQuery = "(mimeType='text/vtt' or mimeType='text/plain' or mimeType='application/x-subrip') and (name contains 'transcript' or name contains 'Transcript' or name contains 'transcrição' or name contains 'Transcrição')";
      const docsQuery = "mimeType='application/vnd.google-apps.document' and (name contains 'Transcript' or name contains 'Transcrição' or name contains 'Gemini' or name contains 'Anotações' or name contains 'Notes')";
      const combined = `((${recordingsQuery}) or (${subtitleQuery}) or (${docsQuery})) and createdTime >= '${sixtyDaysAgo}'`;
      const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(combined)}&fields=files(id,name,createdTime,webViewLink,mimeType)&orderBy=createdTime desc&pageSize=200`;
      try {
        const resp = await fetch(driveUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!resp.ok) {
          console.log(`Drive API error for user ${userId}: ${resp.status}`);
          driveCache.set(userId, []);
          return [];
        }
        const data = await resp.json();
        const files = (data.files || []) as DriveFile[];
        driveCache.set(userId, files);
        return files;
      } catch (e) {
        console.error("Drive fetch failed:", e);
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

    // AssemblyAI assíncrono: submete e guarda o job em transcript_job_id; se não terminar
    // nesta execução, a próxima passada busca o resultado. Upload em streaming do Drive
    // (webContentLink não funciona pra arquivo privado).
    let assemblyAiUsed = 0;
    const submitToAssemblyAI = async (fileId: string, accessToken: string): Promise<string | null> => {
      if (!assemblyAiKey || assemblyAiUsed >= MAX_ASSEMBLYAI_PER_RUN) return null;
      try {
        const metaResp = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=size`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const meta = metaResp.ok ? await metaResp.json() : {};
        const fileSize = parseInt(meta.size || "0");
        if (fileSize > MAX_RECORDING_BYTES) {
          console.log(`AssemblyAI: arquivo ${fileId} grande demais (${fileSize})`);
          return null;
        }

        const fileResp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!fileResp.ok || !fileResp.body) {
          console.log(`AssemblyAI: download do Drive falhou (${fileResp.status})`);
          return null;
        }

        const uploadResp = await fetch("https://api.assemblyai.com/v2/upload", {
          method: "POST",
          headers: { Authorization: assemblyAiKey },
          body: fileResp.body,
        });
        if (!uploadResp.ok) {
          console.log(`AssemblyAI: upload falhou (${uploadResp.status})`);
          return null;
        }
        const { upload_url } = await uploadResp.json();

        assemblyAiUsed++;
        const submitResp = await fetch("https://api.assemblyai.com/v2/transcript", {
          method: "POST",
          headers: { Authorization: assemblyAiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ audio_url: upload_url, language_code: "pt", speaker_labels: true }),
        });
        if (!submitResp.ok) {
          console.log(`AssemblyAI: submit falhou (${submitResp.status})`);
          return null;
        }
        const { id: jobId } = await submitResp.json();
        return jobId || null;
      } catch (e) {
        console.error("AssemblyAI submit exception:", e);
        return null;
      }
    };

    // done=true encerra o job (com ou sem texto); done=false = ainda processando, tenta depois
    const pollAssemblyAI = async (jobId: string, maxAttempts: number): Promise<{ done: boolean; text: string | null }> => {
      if (!assemblyAiKey) return { done: false, text: null };
      for (let attempts = 0; attempts < maxAttempts; attempts++) {
        try {
          const pollResp = await fetch(`https://api.assemblyai.com/v2/transcript/${jobId}`, {
            headers: { Authorization: assemblyAiKey },
          });
          if (pollResp.ok) {
            const pollData = await pollResp.json();
            if (pollData.status === "completed") {
              const text = pollData.utterances?.length
                ? pollData.utterances.map((u: { speaker: string; text: string }) => `[Participante ${u.speaker}]: ${u.text}`).join("\n\n")
                : pollData.text || "";
              return { done: true, text: text.length > 50 ? text : null };
            }
            if (pollData.status === "error") {
              console.error(`AssemblyAI error (job ${jobId}): ${pollData.error}`);
              return { done: true, text: null };
            }
          } else if (pollResp.status === 404 || pollResp.status === 400) {
            return { done: true, text: null };
          }
        } catch { /* tenta de novo */ }
        if (attempts < maxAttempts - 1) await new Promise((r) => setTimeout(r, 10000));
      }
      return { done: false, text: null };
    };

    // Cada arquivo do Drive só casa com uma reunião — INCLUSIVE entre execuções.
    // (Bug histórico: o Set começava vazio a cada run e o mesmo arquivo era dado
    // a reuniões de OUTROS clientes em runs seguintes — transcrição contaminada.)
    const usedFileIds = new Set<string>();
    for (const m of meetingsData || []) {
      const rl = (m as { recording_link?: string }).recording_link || "";
      const idMatch = rl.match(/\/file\/d\/([^/?#]+)/);
      if (idMatch) usedFileIds.add(idMatch[1]);
      const tsrc = (m as { transcript_source_file_id?: string }).transcript_source_file_id;
      if (tsrc) usedFileIds.add(tsrc);
    }
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    // Janela válida: arquivo do Meet é criado no FIM da gravação — nunca antes da reunião começar
    const inWindow = (f: DriveFile, meetingDate: Date): boolean => {
      const diff = new Date(f.createdTime).getTime() - meetingDate.getTime();
      return diff >= -5 * 60 * 1000 && diff <= 12 * 3600 * 1000;
    };

    // Arquivo cujo nome contém o título de uma reunião da janela é "dono" dela — proximidade
    // nunca pode roubar arquivo alheio. Reuniões recorrentes repetem título, então o dono é a
    // ocorrência mais próxima no tempo do arquivo.
    const allTitles = (meetingsData || [])
      .map((m) => ({ id: m.id, t: norm(m.meeting_title || m.subject || ""), date: new Date(m.meeting_date).getTime() }))
      .filter((x) => x.t.length >= 5);
    const fileOwnerCache = new Map<string, string | null>();
    const fileOwner = (f: DriveFile): string | null => {
      if (fileOwnerCache.has(f.id)) return fileOwnerCache.get(f.id)!;
      const n = norm(f.name);
      const fTime = new Date(f.createdTime).getTime();
      let owner: string | null = null;
      let ownerLen = 0;
      let ownerDiff = Infinity;
      for (const { id, t, date } of allTitles) {
        if (!n.includes(t)) continue;
        const diff = Math.abs(fTime - date);
        if (t.length > ownerLen || (t.length === ownerLen && diff < ownerDiff)) {
          owner = id; ownerLen = t.length; ownerDiff = diff;
        }
      }
      fileOwnerCache.set(f.id, owner);
      return owner;
    };

    // Proximidade GLOBAL: o arquivo pertence à reunião mais próxima dele no tempo,
    // entre TODAS as reuniões da janela (qualquer projeto). Impede uma reunião de
    // "roubar" a gravação de outro cliente só porque foi processada antes.
    const allMeetingTimes = (meetingsData || []).map((m) => ({
      id: m.id as string,
      time: new Date(m.meeting_date as string).getTime(),
    }));
    const closestMeetingCache = new Map<string, string | null>();
    const closestMeetingTo = (f: DriveFile): string | null => {
      if (closestMeetingCache.has(f.id)) return closestMeetingCache.get(f.id)!;
      const fTime = new Date(f.createdTime).getTime();
      let bestId: string | null = null;
      let bestDiff = Infinity;
      for (const { id, time } of allMeetingTimes) {
        const diff = fTime - time;
        if (diff < -5 * 60 * 1000 || diff > 12 * 3600 * 1000) continue;
        const abs = Math.abs(diff);
        if (abs < bestDiff) { bestDiff = abs; bestId = id; }
      }
      closestMeetingCache.set(f.id, bestId);
      return bestId;
    };

    const pickByProximity = (files: DriveFile[], meetingDate: Date, meetingId: string): DriveFile | null => {
      let best: DriveFile | null = null;
      let bestDiff = Infinity;
      for (const f of files) {
        if (usedFileIds.has(f.id)) continue;
        const owner = fileOwner(f);
        if (owner && owner !== meetingId) continue;
        // sem match de título: só aceita o arquivo se ESTA reunião for a mais
        // próxima dele no tempo entre todas — senão ele é de outra reunião
        if (!owner && closestMeetingTo(f) !== meetingId) continue;
        if (!inWindow(f, meetingDate)) continue;
        const diff = Math.abs(new Date(f.createdTime).getTime() - meetingDate.getTime());
        if (diff < bestDiff) { bestDiff = diff; best = f; }
      }
      return best;
    };
    // Título no nome do arquivo vale mais que proximidade — mas a janela de horário SEMPRE vale
    // (reunião recorrente repete título; sem janela, arquivo de outro dia entra errado)
    const pickFile = (files: DriveFile[], meetingDate: Date, title: string | null, meetingId: string): DriveFile | null => {
      const t = norm(title || "");
      if (t.length >= 5) {
        const byName = files.filter((f) => !usedFileIds.has(f.id) && norm(f.name).includes(t) && inWindow(f, meetingDate));
        if (byName.length > 0) {
          let best: DriveFile | null = null;
          let bestDiff = Infinity;
          for (const f of byName) {
            const d = Math.abs(new Date(f.createdTime).getTime() - meetingDate.getTime());
            if (d < bestDiff) { bestDiff = d; best = f; }
          }
          return best;
        }
      }
      return pickByProximity(files, meetingDate, meetingId);
    };

    let totalRecordingsSynced = 0;
    let totalTranscriptsSynced = 0;
    let totalMeetingsFinalized = 0;
    let totalTasksCreated = 0;

    for (const meeting of meetings) {
      const meetingDate = new Date(meeting.meeting_date);
      // Reunião já com transcrição e gravação não precisa de busca de arquivos —
      // segue direto pros passos de finalização/tarefa (idempotentes)
      const needsFiles = !meeting.transcript || !meeting.recording_link;
      const users = needsFiles ? candidateUsers(meeting) : [];
      if (needsFiles && users.length === 0) continue;

      let recordingFile: DriveFile | null = null;
      let transcriptFile: DriveFile | null = null;
      let workingToken: string | null = null;

      for (const userId of users) {
        const accessToken = await getAccessToken(userId);
        if (!accessToken) continue;
        if (!workingToken) workingToken = accessToken;

        // 1) Anexos do evento no Calendar (matching exato)
        if (meeting.google_event_id && !recordingFile && !transcriptFile) {
          try {
            const evResp = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(meeting.google_event_id)}?fields=attachments`,
              { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            if (evResp.ok) {
              const ev = await evResp.json();
              const atts: DriveFile[] = (ev.attachments || []).map((a: { fileId: string; title: string; mimeType: string }) => ({
                id: a.fileId,
                name: a.title || "",
                mimeType: a.mimeType || "",
                createdTime: meeting.meeting_date,
              }));
              if (!recordingFile) recordingFile = atts.find((f) => f.mimeType === "video/mp4" && !usedFileIds.has(f.id)) || null;
              if (!transcriptFile) {
                transcriptFile = atts.find((f) =>
                  (f.mimeType === "application/vnd.google-apps.document" || f.mimeType.startsWith("text/")) &&
                  TRANSCRIPT_NAME_RE.test(f.name) && !usedFileIds.has(f.id)) || null;
              }
            }
          } catch { /* segue pro Drive */ }
        }

        // 2) Fallback: Drive por proximidade
        if (!recordingFile || !transcriptFile) {
          const files = await getDriveFiles(userId, accessToken);
          const meetingTitle = meeting.meeting_title || meeting.subject || null;
          if (!recordingFile) {
            recordingFile = pickFile(files.filter((f) => f.mimeType === "video/mp4"), meetingDate, meetingTitle, meeting.id);
          }
          if (!transcriptFile) {
            transcriptFile = pickFile(
              files.filter((f) => f.mimeType !== "video/mp4" && TRANSCRIPT_NAME_RE.test(f.name)),
              meetingDate,
              meetingTitle,
              meeting.id,
            );
          }
        }

        if (recordingFile && transcriptFile) {
          workingToken = accessToken;
          break;
        }
        if (recordingFile || transcriptFile) workingToken = accessToken;
      }

      if (needsFiles && !workingToken) continue;

      // Grava recording_link
      if (recordingFile && !meeting.recording_link) {
        usedFileIds.add(recordingFile.id);
        const link = recordingFile.webViewLink || `https://drive.google.com/file/d/${recordingFile.id}/view`;
        await supabase
          .from("onboarding_meeting_notes")
          .update({ recording_link: link })
          .eq("id", meeting.id);
        meeting.recording_link = link;
        totalRecordingsSynced++;
      }

      // Transcrição: job pendente do AssemblyAI → arquivo do Drive → nova submissão
      if (!meeting.transcript) {
        let transcriptText: string | null = null;
        let clearJobId = false;

        // 1) Job de execução anterior ainda pendente
        if (meeting.transcript_job_id) {
          const r = await pollAssemblyAI(meeting.transcript_job_id, 2);
          if (r.done) {
            clearJobId = true;
            if (r.text) transcriptText = r.text;
          }
        }

        // 2) Arquivo de transcrição do Drive
        if (!transcriptText && transcriptFile && workingToken) {
          transcriptText = await downloadTranscriptText(transcriptFile, workingToken);
          if (transcriptText) usedFileIds.add(transcriptFile.id);
        }

        // 3) Submete a gravação pro AssemblyAI (se não há job em aberto)
        if (!transcriptText && recordingFile && workingToken && (!meeting.transcript_job_id || clearJobId)) {
          console.log(`Transcribing recording via AssemblyAI for meeting ${meeting.id} (${meeting.meeting_title})`);
          const jobId = await submitToAssemblyAI(recordingFile.id, workingToken);
          if (jobId) {
            await supabase
              .from("onboarding_meeting_notes")
              .update({ transcript_job_id: jobId })
              .eq("id", meeting.id);
            meeting.transcript_job_id = jobId;
            clearJobId = false;
            const r = await pollAssemblyAI(jobId, 18);
            if (r.done) {
              clearJobId = true;
              if (r.text) transcriptText = r.text;
            } else {
              console.log(`AssemblyAI job ${jobId} segue processando — próxima passada busca o resultado`);
            }
          }
        }

        if (transcriptText || clearJobId) {
          const updates: Record<string, unknown> = {};
          if (transcriptText) updates.transcript = transcriptText;
          if (transcriptText && transcriptFile) updates.transcript_source_file_id = transcriptFile.id;
          if (transcriptText && !transcriptFile && recordingFile) updates.transcript_source_file_id = recordingFile.id;
          if (clearJobId) updates.transcript_job_id = null;
          await supabase
            .from("onboarding_meeting_notes")
            .update(updates)
            .eq("id", meeting.id);
          if (transcriptText) {
            meeting.transcript = transcriptText;
            totalTranscriptsSynced++;
            console.log(`✓ Transcript synced for meeting: ${meeting.meeting_title || meeting.subject}`);
          }
        }
      }

      // Finaliza reunião com gravação
      if (meeting.recording_link && !meeting.is_finalized) {
        const autoNotes = meeting.notes || `Reunião finalizada automaticamente pelo sistema.\n\nGravação disponível: ${meeting.recording_link}`;
        const { error: finalizeError } = await supabase
          .from("onboarding_meeting_notes")
          .update({ is_finalized: true, notes: autoNotes })
          .eq("id", meeting.id);

        if (!finalizeError) {
          meeting.is_finalized = true;
          totalMeetingsFinalized++;
          console.log(`✓ Meeting auto-finalized: ${meeting.meeting_title || meeting.subject}`);

          if (meeting.transcript && meeting.transcript.length > 50) {
            supabase.functions.invoke("summarize-meeting-transcription", {
              body: { meetingId: meeting.id },
            }).catch((e: unknown) => console.error("[sync-all-recordings] summarize error:", e));

            supabase.functions.invoke("generate-meeting-actions", {
              body: { meetingId: meeting.id, projectId: meeting.project_id },
            }).catch((e: unknown) => console.error("[sync-all-recordings] generate-actions error:", e));
          }
        }
      }

      // Com transcrição: finaliza a tarefa de reunião ORIGINAL com a transcrição dentro
      if (meeting.transcript && meeting.transcript.length > 50) {
        const meetingTitle = meeting.meeting_title || meeting.subject || "Reunião";
        const taskTitle = `📝 Transcrição: ${meetingTitle}`;

        const truncatedForTask = meeting.transcript.length > 8000
          ? meeting.transcript.substring(0, 8000) + "\n\n... [transcrição truncada]"
          : meeting.transcript;
        const transcriptBlock = `## Transcrição da Reunião\n\n**Data:** ${new Date(meeting.meeting_date).toLocaleDateString('pt-BR')}\n**Assunto:** ${meetingTitle}\n\n---\n\n${truncatedForTask}`;

        let originalTask: { id: string; status: string; observations: string | null } | null = null;
        if (meeting.meeting_link) {
          const { data: byLink } = await supabase
            .from("onboarding_tasks")
            .select("id, status, observations")
            .eq("project_id", meeting.project_id)
            .eq("meeting_link", meeting.meeting_link)
            .limit(1);
          originalTask = byLink?.[0] || null;
        }
        if (!originalTask) {
          const { data: byTitle } = await supabase
            .from("onboarding_tasks")
            .select("id, status, observations")
            .eq("project_id", meeting.project_id)
            .ilike("title", meetingTitle)
            .limit(1);
          originalTask = byTitle?.[0] || null;
        }

        if (originalTask) {
          const updates: Record<string, unknown> = {};
          if (!(originalTask.observations || "").includes("## Transcrição da Reunião")) {
            updates.observations = originalTask.observations
              ? `${originalTask.observations}\n\n${transcriptBlock}`
              : transcriptBlock;
          }
          if (originalTask.status !== "completed") {
            updates.status = "completed";
            updates.completed_at = new Date().toISOString();
          }
          if (Object.keys(updates).length > 0) {
            const { error: taskUpdateError } = await supabase
              .from("onboarding_tasks")
              .update(updates)
              .eq("id", originalTask.id);
            if (!taskUpdateError) {
              totalTasksCreated++;
              console.log(`✓ Original meeting task finalized with transcript: ${meetingTitle}`);
            }
          }
          continue;
        }

        // Fallback: sem tarefa original — cria tarefa de transcrição (comportamento anterior)
        const { data: existingTask } = await supabase
          .from("onboarding_tasks")
          .select("id")
          .eq("project_id", meeting.project_id)
          .ilike("title", `%Transcrição: ${meetingTitle}%`)
          .limit(1);

        if (!existingTask || existingTask.length === 0) {
          const { data: projectData } = await supabase
            .from("onboarding_projects")
            .select("onboarding_company_id")
            .eq("id", meeting.project_id)
            .single();

          let responsibleStaffId = null;
          if (projectData?.onboarding_company_id) {
            const { data: companyData } = await supabase
              .from("onboarding_companies")
              .select("consultant_id, cs_id")
              .eq("id", projectData.onboarding_company_id)
              .single();
            responsibleStaffId = companyData?.consultant_id || companyData?.cs_id;
          }

          const taskDescription = `## Transcrição da Reunião\n\n**Data:** ${new Date(meeting.meeting_date).toLocaleDateString('pt-BR')}\n**Assunto:** ${meetingTitle}\n\n---\n\n${truncatedForTask.substring(0, 5000)}`;

          const { error: taskError } = await supabase
            .from("onboarding_tasks")
            .insert({
              project_id: meeting.project_id,
              title: taskTitle,
              description: taskDescription,
              priority: "medium",
              status: "completed",
              due_date: new Date(meeting.meeting_date).toISOString().split('T')[0],
              completed_at: new Date().toISOString(),
              responsible_staff_id: responsibleStaffId,
              tags: ["transcrição", "reunião"],
              sort_order: 0
            });

          if (!taskError) {
            totalTasksCreated++;
            console.log(`✓ Task created for meeting transcript: ${meetingTitle}`);
          }
        }
      }
    }

    console.log(`Sync complete: ${totalRecordingsSynced} recordings, ${totalTranscriptsSynced} transcripts, ${totalMeetingsFinalized} meetings finalized, ${totalTasksCreated} tasks updated`);

    return new Response(
      JSON.stringify({
        success: true,
        meetingsChecked: meetings.length,
        recordingsSynced: totalRecordingsSynced,
        transcriptsSynced: totalTranscriptsSynced,
        meetingsFinalized: totalMeetingsFinalized,
        tasksUpdated: totalTasksCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
