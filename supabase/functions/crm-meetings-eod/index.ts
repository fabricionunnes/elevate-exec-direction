import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * crm-meetings-eod — Fechamento diário das reuniões do CRM Comercial (cron 20:00 BRT).
 *
 * Para cada reunião agendada do dia ainda pendente:
 *  1. Busca gravação e transcrição do Meet (anexos do evento no Calendar → fallback busca no Drive)
 *  2. Importa a transcrição para crm_transcriptions (aba Transcrição do lead) + gera briefing IA
 *  3. Vincula a gravação (recording_url) e finaliza a atividade (status=completed)
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

    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* cron chama sem body */ }
    const dryRun = url.searchParams.get("dry") === "1" || body.dry === true;

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

    console.log(`[crm-meetings-eod] dia=${dayStr} dry=${dryRun}`);

    const { data: meetings, error: meetingsError } = await supabase
      .from("crm_activities")
      .select(`
        id, lead_id, title, scheduled_at, status, notes, meeting_link,
        google_calendar_event_id, google_calendar_user_id, responsible_staff_id, recording_url,
        lead:lead_id (id, name, company)
      `)
      .eq("type", "meeting")
      .eq("status", "pending")
      .gte("scheduled_at", dayStartUtc)
      .lte("scheduled_at", windowEndUtc)
      .order("scheduled_at");

    if (meetingsError) throw meetingsError;

    if (!meetings || meetings.length === 0) {
      console.log("[crm-meetings-eod] Nenhuma reunião pendente do dia");
      return new Response(
        JSON.stringify({ success: true, day: dayStr, meetings: 0, finalized: 0, transcriptsImported: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[crm-meetings-eod] ${meetings.length} reuniões pendentes do dia`);

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
      const recordingsQuery = "mimeType='video/mp4' and (name contains 'Meet Recording' or name contains 'Gravação')";
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

    const transcribeViaAssemblyAI = async (fileId: string, accessToken: string): Promise<{ text: string; jobId: string } | null> => {
      if (!assemblyAiKey) return null;
      try {
        const metaResp = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webContentLink,size`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!metaResp.ok) return null;
        const meta = await metaResp.json();
        const fileSize = parseInt(meta.size || "0");
        if (fileSize > 100 * 1024 * 1024 || !meta.webContentLink) return null;

        const submitResp = await fetch("https://api.assemblyai.com/v2/transcript", {
          method: "POST",
          headers: { Authorization: assemblyAiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ audio_url: meta.webContentLink, language_code: "pt", speaker_labels: true }),
        });
        if (!submitResp.ok) return null;
        const { id: jobId } = await submitResp.json();

        let status = "queued";
        let attempts = 0;
        while ((status === "queued" || status === "processing") && attempts < 24) {
          await new Promise((r) => setTimeout(r, 10000));
          const pollResp = await fetch(`https://api.assemblyai.com/v2/transcript/${jobId}`, {
            headers: { Authorization: assemblyAiKey },
          });
          if (pollResp.ok) {
            const pollData = await pollResp.json();
            status = pollData.status;
            if (status === "completed") {
              const text = pollData.utterances?.length
                ? pollData.utterances.map((u: { speaker: string; text: string }) => `[Participante ${u.speaker}]: ${u.text}`).join("\n\n")
                : pollData.text || "";
              return text.length > 50 ? { text, jobId } : null;
            }
            if (status === "error") return null;
          }
          attempts++;
        }
        return null;
      } catch {
        return null;
      }
    };

    const usedFileIds = new Set<string>();
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
          const pickByProximity = (files: DriveFile[]): DriveFile | null => {
            let best: DriveFile | null = null;
            let bestDiff = Infinity;
            for (const f of files) {
              if (usedFileIds.has(f.id)) continue;
              const diff = new Date(f.createdTime).getTime() - scheduledAt.getTime();
              // arquivo criado entre 30min antes e 10h depois do início da reunião
              if (diff < -30 * 60 * 1000 || diff > 10 * 3600 * 1000) continue;
              if (Math.abs(diff) < bestDiff) { bestDiff = Math.abs(diff); best = f; }
            }
            return best;
          };

          const transcriptFile = attTranscript ||
            pickByProximity(driveFiles.filter((f) => f.mimeType !== "video/mp4" && TRANSCRIPT_NAME_RE.test(f.name)));
          const recordingFile = attRecording ||
            pickByProximity(driveFiles.filter((f) => f.mimeType === "video/mp4"));

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

          // 3) Último recurso: transcrever a gravação via AssemblyAI
          if (!transcriptText && recordingFile && !dryRun) {
            const ai = await transcribeViaAssemblyAI(recordingFile.id, accessToken);
            if (ai) {
              transcriptText = ai.text;
              transcriptSourceId = `assemblyai:${ai.jobId}`;
            }
          }
        } else {
          result.warning = "sem token Google";
        }
      } else {
        result.warning = "sem usuário Google vinculado";
      }

      // Importa transcrição pra aba Transcrição do lead
      if (transcriptText && meeting.lead_id) {
        const { data: existing } = transcriptSourceId
          ? await supabase
              .from("crm_transcriptions")
              .select("id")
              .eq("source_meeting_id", transcriptSourceId)
              .limit(1)
          : { data: null };

        if (!existing || existing.length === 0) {
          const title = `Reunião ${scheduledAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} — ${leadName}`;
          if (!dryRun) {
            const { data: inserted, error: insertError } = await supabase
              .from("crm_transcriptions")
              .insert({
                lead_id: meeting.lead_id,
                title,
                transcription_text: transcriptText,
                source: "google-meet-auto",
                source_meeting_id: transcriptSourceId,
                source_meeting_url: meeting.meeting_link,
                recorded_at: meeting.scheduled_at,
                language: "pt-BR",
                status: "completed",
              })
              .select("id")
              .single();

            if (insertError) {
              console.error(`[crm-meetings-eod] Erro ao inserir transcrição (lead ${meeting.lead_id}):`, insertError);
            } else {
              transcriptsImported++;
              result.transcript = true;

              // Briefing IA (best-effort)
              try {
                const briefResp = await fetch(`${supabaseUrl}/functions/v1/generate-crm-briefing`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
                  body: JSON.stringify({
                    transcription: transcriptText,
                    leadName,
                    companyName: lead?.company || "",
                  }),
                });
                if (briefResp.ok) {
                  const { briefing } = await briefResp.json();
                  if (briefing) {
                    await supabase.from("crm_transcriptions").update({ ai_analysis: briefing }).eq("id", inserted.id);
                  }
                }
              } catch (e) {
                console.error("[crm-meetings-eod] Briefing falhou:", e);
              }
            }
          } else {
            result.transcript = "dry-run";
          }
        } else {
          result.transcript = "já importada";
        }
      }

      if (recordingLink && recordingLink !== meeting.recording_url) {
        result.recording = true;
        recordingsLinked++;
      }

      // Finaliza a reunião do dia
      const autoNote = result.transcript === true || result.transcript === "já importada"
        ? "Finalizada automaticamente (20h) — transcrição importada para a aba Transcrição."
        : recordingLink
          ? "Finalizada automaticamente (20h) — gravação vinculada, sem transcrição encontrada."
          : "Finalizada automaticamente (20h) — nenhuma gravação/transcrição encontrada no Google.";

      if (!dryRun) {
        const { error: updError } = await supabase
          .from("crm_activities")
          .update({
            status: "completed",
            completed_at: now.toISOString(),
            recording_url: recordingLink,
            notes: meeting.notes ? `${meeting.notes}\n\n${autoNote}` : autoNote,
          })
          .eq("id", meeting.id);
        if (updError) {
          console.error(`[crm-meetings-eod] Erro ao finalizar atividade ${meeting.id}:`, updError);
          result.error = updError.message;
        } else {
          finalized++;
        }
      }

      result.note = autoNote;
      results.push(result);
    }

    console.log(`[crm-meetings-eod] fim: ${finalized} finalizadas, ${transcriptsImported} transcrições, ${recordingsLinked} gravações`);

    return new Response(
      JSON.stringify({
        success: true,
        day: dayStr,
        dryRun,
        meetings: meetings.length,
        finalized,
        transcriptsImported,
        recordingsLinked,
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
