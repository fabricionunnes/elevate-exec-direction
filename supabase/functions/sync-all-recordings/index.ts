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

      // Get meetings without recordings or transcripts
      const { data: meetings } = await supabase
        .from("onboarding_meeting_notes")
        .select("id, meeting_title, meeting_date, subject, recording_link, transcript")
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
          }
        }
      }

      projectsProcessed++;
    }

    console.log(`Sync complete: ${totalRecordingsSynced} recordings, ${totalTranscriptsSynced} transcripts across ${projectsProcessed} projects`);

    return new Response(
      JSON.stringify({
        success: true,
        projectsProcessed,
        recordingsSynced: totalRecordingsSynced,
        transcriptsSynced: totalTranscriptsSynced,
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
