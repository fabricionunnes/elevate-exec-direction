import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Cron job function to sync recordings and transcripts for all active projects
 * Runs daily at 20:00 (scheduled via pg_cron)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting daily recordings/transcripts sync...");

    // Get all active projects with assigned consultants who have Google Calendar connected
    const { data: projects, error: projectsError } = await supabase
      .from("onboarding_projects")
      .select(`
        id,
        company:company_id (
          id,
          name
        ),
        consultant_id
      `)
      .eq("status", "active")
      .not("consultant_id", "is", null);

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      throw projectsError;
    }

    if (!projects || projects.length === 0) {
      console.log("No active projects found");
      return new Response(
        JSON.stringify({ message: "No active projects", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${projects.length} active projects`);

    // Get consultant details for all projects
    const consultantIds = projects.map((p) => p.consultant_id).filter(Boolean);
    const { data: consultants } = await supabase
      .from("onboarding_staff")
      .select("id, name, user_id")
      .in("id", consultantIds);

    const consultantMap = new Map(consultants?.map((c) => [c.id, c]) || []);

    if (!projects || projects.length === 0) {
      console.log("No active projects found");
      return new Response(
        JSON.stringify({ message: "No active projects", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${projects.length} active projects`);

    // Get all user tokens for consultants
    const consultantUserIds = consultants
      ?.filter((c) => c.user_id)
      .map((c) => c.user_id) || [];

    const uniqueUserIds = [...new Set(consultantUserIds)];

    const { data: tokens } = await supabase
      .from("user_google_tokens")
      .select("*")
      .in("user_id", uniqueUserIds);

    const tokenMap = new Map(tokens?.map((t) => [t.user_id, t]) || []);

    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    let totalRecordingsSynced = 0;
    let totalTranscriptsSynced = 0;
    let totalMeetingsFinalized = 0;
    let totalTasksCreated = 0;
    let projectsProcessed = 0;

    // Helper to parse VTT/SRT content to plain text
    const parseSubtitleToText = (content: string): string => {
      const lines = content.split('\n');
      const textLines: string[] = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed === 'WEBVTT') continue;
        if (/^\d+$/.test(trimmed)) continue;
        if (/-->/.test(trimmed)) continue;
        if (/^NOTE/.test(trimmed)) continue;
        if (/^STYLE/.test(trimmed)) continue;
        if (/^Kind:/.test(trimmed)) continue;
        if (/^Language:/.test(trimmed)) continue;
        
        const cleanLine = trimmed.replace(/<[^>]*>/g, '');
        if (cleanLine) {
          textLines.push(cleanLine);
        }
      }
      
      return textLines.join('\n');
    };

    // Process each project
    for (const project of projects) {
      const consultant = consultantMap.get(project.consultant_id);
      if (!consultant?.user_id) {
        console.log(`Project ${project.id}: No consultant or user_id, skipping`);
        continue;
      }

      const tokenData = tokenMap.get(consultant.user_id);
      if (!tokenData) {
        console.log(`Project ${project.id}: Consultant has no Google token, skipping`);
        continue;
      }

      let accessToken = tokenData.access_token;

      // Refresh token if expired
      if (tokenData.token_expires_at && new Date(tokenData.token_expires_at) < new Date()) {
        if (!googleClientId || !googleClientSecret || !tokenData.refresh_token) {
          console.log(`Project ${project.id}: Token expired and cannot refresh`);
          continue;
        }

        const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            refresh_token: tokenData.refresh_token,
            grant_type: "refresh_token",
          }),
        });

        if (!refreshResponse.ok) {
          console.log(`Project ${project.id}: Token refresh failed`);
          continue;
        }

        const refreshData = await refreshResponse.json();
        accessToken = refreshData.access_token;

        // Update token in database
        await supabase
          .from("user_google_tokens")
          .update({
            access_token: accessToken,
            token_expires_at: new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString(),
          })
          .eq("user_id", consultant.user_id);
      }

      // Get meetings (including is_finalized status)
      const { data: meetings } = await supabase
        .from("onboarding_meeting_notes")
        .select("id, meeting_title, meeting_date, subject, recording_link, transcript, is_finalized, notes, project_id")
        .eq("project_id", project.id);

      if (!meetings || meetings.length === 0) {
        continue;
      }

      // Search for recordings AND transcripts in Drive
      const recordingsQuery = "mimeType='video/mp4' and (name contains 'Meet Recording' or name contains 'Gravação')";
      const transcriptQuery = "(mimeType='text/vtt' or mimeType='text/plain' or mimeType='application/x-subrip') and (name contains 'transcript' or name contains 'transcrição' or name contains 'Transcript')";
      
      const combinedQuery = `(${recordingsQuery}) or (${transcriptQuery})`;
      const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(combinedQuery)}&fields=files(id,name,createdTime,webViewLink,mimeType)&orderBy=createdTime desc&pageSize=200`;

      const driveResponse = await fetch(driveUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!driveResponse.ok) {
        console.log(`Project ${project.id}: Drive API error`);
        continue;
      }

      const driveData = await driveResponse.json();
      const allFiles = driveData.files || [];
      
      const recordings = allFiles.filter((f: { mimeType: string }) => f.mimeType === 'video/mp4');
      const transcripts = allFiles.filter((f: { mimeType: string }) => 
        f.mimeType === 'text/vtt' || f.mimeType === 'text/plain' || f.mimeType === 'application/x-subrip'
      );

      // Match files with meetings
      for (const meeting of meetings) {
        const meetingDate = new Date(meeting.meeting_date);
        const meetingDateStr = meetingDate.toISOString().split('T')[0];
        const titleWords = (meeting.meeting_title || meeting.subject || "").toLowerCase().split(" ").filter((w: string) => w.length > 3);

        // Sync recording if not linked
        if (!meeting.recording_link) {
          const matchingRecording = recordings.find((rec: { createdTime: string; name: string }) => {
            const recDate = new Date(rec.createdTime);
            const recDateStr = recDate.toISOString().split('T')[0];
            return recDateStr === meetingDateStr;
          });

          if (matchingRecording) {
            await supabase
              .from("onboarding_meeting_notes")
              .update({ recording_link: matchingRecording.webViewLink })
              .eq("id", meeting.id);
            totalRecordingsSynced++;
          }
        }

        // Sync transcript if empty (using new transcript column)
        if (!meeting.transcript) {
          const matchingTranscript = transcripts.find((t: { createdTime: string; name: string }) => {
            const tDate = new Date(t.createdTime);
            const tDateStr = tDate.toISOString().split('T')[0];
            return tDateStr === meetingDateStr;
          });

          if (matchingTranscript) {
            try {
              const downloadUrl = `https://www.googleapis.com/drive/v3/files/${matchingTranscript.id}?alt=media`;
              const downloadResponse = await fetch(downloadUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              
              if (downloadResponse.ok) {
                const content = await downloadResponse.text();
                const transcriptText = parseSubtitleToText(content);
                
                if (transcriptText.length > 50) {
                  await supabase
                    .from("onboarding_meeting_notes")
                    .update({ transcript: transcriptText })
                    .eq("id", meeting.id);
                  totalTranscriptsSynced++;
                }
              }
            } catch (err) {
              console.error(`Error downloading transcript for meeting ${meeting.id}:`, err);
            }
          } else if (meeting.recording_link) {
            // No Drive transcript found, but has recording - use AssemblyAI
            try {
              const assemblyAiKey = Deno.env.get("ASSEMBLYAI_API_KEY");
              if (assemblyAiKey) {
                console.log(`Project ${project.id}: Transcribing recording for meeting ${meeting.id} via AssemblyAI`);
                
                // Extract file ID from Google Drive link
                const driveMatch = meeting.recording_link.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (driveMatch) {
                  const fileId = driveMatch[1];
                  
                  // Get file metadata for download URL
                  const metaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webContentLink,size`;
                  const metaResp = await fetch(metaUrl, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                  });
                  
                  if (metaResp.ok) {
                    const meta = await metaResp.json();
                    const fileSize = parseInt(meta.size || "0");
                    
                    // AssemblyAI limit ~100MB for URL submission
                    if (fileSize <= 100 * 1024 * 1024 && meta.webContentLink) {
                      // Submit to AssemblyAI
                      const transcriptResp = await fetch("https://api.assemblyai.com/v2/transcript", {
                        method: "POST",
                        headers: {
                          "Authorization": assemblyAiKey,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          audio_url: meta.webContentLink,
                          language_code: "pt",
                          speaker_labels: true,
                        }),
                      });
                      
                      if (transcriptResp.ok) {
                        const transcriptData = await transcriptResp.json();
                        const transcriptId = transcriptData.id;
                        
                        // Poll for completion (max 5 min)
                        let status = "queued";
                        let attempts = 0;
                        let finalTranscript = "";
                        
                        while ((status === "queued" || status === "processing") && attempts < 30) {
                          await new Promise(r => setTimeout(r, 10000)); // 10s intervals
                          
                          const pollResp = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
                            headers: { "Authorization": assemblyAiKey },
                          });
                          
                          if (pollResp.ok) {
                            const pollData = await pollResp.json();
                            status = pollData.status;
                            
                            if (status === "completed") {
                              if (pollData.utterances && pollData.utterances.length > 0) {
                                finalTranscript = pollData.utterances
                                  .map((u: { speaker: string; text: string }) => `[Participante ${u.speaker}]: ${u.text}`)
                                  .join('\n\n');
                              } else {
                                finalTranscript = pollData.text || "";
                              }
                            } else if (status === "error") {
                              console.error(`AssemblyAI error for meeting ${meeting.id}:`, pollData.error);
                              break;
                            }
                          }
                          attempts++;
                        }
                        
                        if (finalTranscript && finalTranscript.length > 50) {
                          await supabase
                            .from("onboarding_meeting_notes")
                            .update({ transcript: finalTranscript })
                            .eq("id", meeting.id);
                          totalTranscriptsSynced++;
                          console.log(`Successfully transcribed meeting ${meeting.id} via AssemblyAI`);
                        }
                      }
                    }
                  }
                }
              }
            } catch (err) {
              console.error(`Error AI-transcribing meeting ${meeting.id}:`, err);
            }
          }
        }
        // After processing transcript, auto-finalize meeting if has recording but not finalized
        const currentRecordingLink = meeting.recording_link;
        const currentTranscript = meeting.transcript;
        
        // Refresh meeting data to get latest state
        const { data: refreshedMeeting } = await supabase
          .from("onboarding_meeting_notes")
          .select("id, meeting_title, meeting_date, subject, recording_link, transcript, is_finalized, notes, project_id")
          .eq("id", meeting.id)
          .single();

        if (refreshedMeeting && refreshedMeeting.recording_link && !refreshedMeeting.is_finalized) {
          console.log(`Auto-finalizing meeting: ${refreshedMeeting.meeting_title || refreshedMeeting.subject}`);
          
          // Auto-finalize the meeting
          const autoNotes = refreshedMeeting.notes || `Reunião finalizada automaticamente pelo sistema.\n\nGravação disponível: ${refreshedMeeting.recording_link}`;
          
          const { error: finalizeError } = await supabase
            .from("onboarding_meeting_notes")
            .update({ 
              is_finalized: true,
              notes: autoNotes
            })
            .eq("id", refreshedMeeting.id);

          if (!finalizeError) {
            totalMeetingsFinalized++;
            console.log(`✓ Meeting auto-finalized: ${refreshedMeeting.meeting_title || refreshedMeeting.subject}`);
          }
        }

        // If meeting has transcript, create a task with the transcript
        if (refreshedMeeting && refreshedMeeting.transcript && refreshedMeeting.transcript.length > 50) {
          // Check if task already exists for this meeting
          const meetingTitle = refreshedMeeting.meeting_title || refreshedMeeting.subject || "Reunião";
          const taskTitle = `📝 Transcrição: ${meetingTitle}`;
          
          const { data: existingTask } = await supabase
            .from("onboarding_tasks")
            .select("id")
            .eq("project_id", refreshedMeeting.project_id)
            .ilike("title", `%Transcrição: ${meetingTitle}%`)
            .limit(1);

          if (!existingTask || existingTask.length === 0) {
            // Get company info for responsible staff
            const { data: projectData } = await supabase
              .from("onboarding_projects")
              .select("onboarding_company_id")
              .eq("id", refreshedMeeting.project_id)
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

            // Truncate transcript if too long for description
            const truncatedTranscript = refreshedMeeting.transcript.length > 5000 
              ? refreshedMeeting.transcript.substring(0, 5000) + "\n\n... [transcrição truncada]"
              : refreshedMeeting.transcript;

            const taskDescription = `## Transcrição da Reunião\n\n**Data:** ${new Date(refreshedMeeting.meeting_date).toLocaleDateString('pt-BR')}\n**Assunto:** ${meetingTitle}\n\n---\n\n${truncatedTranscript}`;

            const { error: taskError } = await supabase
              .from("onboarding_tasks")
              .insert({
                project_id: refreshedMeeting.project_id,
                title: taskTitle,
                description: taskDescription,
                priority: "medium",
                status: "completed",
                due_date: new Date(refreshedMeeting.meeting_date).toISOString().split('T')[0],
                completed_at: new Date().toISOString(),
                responsible_staff_id: responsibleStaffId,
                tags: ["transcrição", "reunião"],
                sort_order: 0
              });

            if (!taskError) {
              totalTasksCreated++;
              console.log(`✓ Task created for meeting transcript: ${meetingTitle}`);
            } else {
              console.error(`Error creating task for meeting ${refreshedMeeting.id}:`, taskError);
            }
          }
        }
      }

      projectsProcessed++;
    }

    console.log(`Sync complete: ${totalRecordingsSynced} recordings, ${totalTranscriptsSynced} transcripts, ${totalMeetingsFinalized} meetings finalized, ${totalTasksCreated} tasks created across ${projectsProcessed} projects`);

    return new Response(
      JSON.stringify({
        success: true,
        projectsProcessed,
        recordingsSynced: totalRecordingsSynced,
        transcriptsSynced: totalTranscriptsSynced,
        meetingsFinalized: totalMeetingsFinalized,
        tasksCreated: totalTasksCreated,
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
