import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge function to transcribe meeting recordings using Lovable AI (ElevenLabs STT).
 * This provides an alternative to AssemblyAI for transcription.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!ELEVENLABS_API_KEY) {
      console.log("ELEVENLABS_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Transcription service not configured. Please add ELEVENLABS_API_KEY." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { meetingId, recordingUrl } = await req.json();

    if (!meetingId || !recordingUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: meetingId and recordingUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting transcription for meeting ${meetingId}`);

    // Get meeting details to find the project and consultant token
    const { data: meeting, error: meetingError } = await supabase
      .from("onboarding_meeting_notes")
      .select("id, project_id, meeting_title, recording_link")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      console.error("Meeting not found:", meetingError);
      return new Response(
        JSON.stringify({ error: "Meeting not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get project consultant's Google token for Drive access
    const { data: project } = await supabase
      .from("onboarding_projects")
      .select("consultant_id, onboarding_company_id")
      .eq("id", meeting.project_id)
      .single();

    let googleAccessToken: string | null = null;

    if (project?.consultant_id) {
      // Get consultant's user_id
      const { data: consultant } = await supabase
        .from("onboarding_staff")
        .select("user_id")
        .eq("id", project.consultant_id)
        .single();

      if (consultant?.user_id) {
        // Get Google token
        const { data: tokenData } = await supabase
          .from("user_google_tokens")
          .select("access_token, refresh_token, token_expires_at")
          .eq("user_id", consultant.user_id)
          .single();

        if (tokenData) {
          // Refresh token if expired
          if (tokenData.token_expires_at && new Date(tokenData.token_expires_at) < new Date()) {
            const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
            const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

            if (googleClientId && googleClientSecret && tokenData.refresh_token) {
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

              if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                googleAccessToken = refreshData.access_token;

                // Update token in database
                await supabase
                  .from("user_google_tokens")
                  .update({
                    access_token: googleAccessToken,
                    token_expires_at: new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString(),
                  })
                  .eq("user_id", consultant.user_id);
              }
            }
          } else {
            googleAccessToken = tokenData.access_token;
          }
        }
      }
    }

    // Extract file ID from Google Drive URL
    const fileIdMatch = recordingUrl.match(/\/d\/([^\/]+)/);
    if (!fileIdMatch) {
      return new Response(
        JSON.stringify({ error: "Invalid recording URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileId = fileIdMatch[1];
    console.log(`Downloading file ${fileId} from Google Drive...`);

    if (!googleAccessToken) {
      return new Response(
        JSON.stringify({ error: "No Google Drive access. Please reconnect the consultant's Google account." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get file metadata
    const metadataResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,size,mimeType&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${googleAccessToken}` } }
    );

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error("Failed to get file metadata:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to access recording file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metadata = await metadataResponse.json();
    const fileSize = parseInt(metadata.size || "0", 10);
    const maxSize = 25 * 1024 * 1024; // 25MB limit for ElevenLabs

    console.log(`File: ${metadata.name}, Size: ${Math.round(fileSize / 1024 / 1024)}MB`);

    if (fileSize > maxSize) {
      return new Response(
        JSON.stringify({ 
          error: `File too large for transcription (${Math.round(fileSize / 1024 / 1024)}MB). Maximum is 25MB. Use manual transcription.`,
          fileSizeMB: Math.round(fileSize / 1024 / 1024)
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download the file
    console.log("Downloading recording...");
    const downloadResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${googleAccessToken}` } }
    );

    if (!downloadResponse.ok) {
      console.error("Failed to download file:", downloadResponse.status);
      return new Response(
        JSON.stringify({ error: "Failed to download recording from Google Drive" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBlob = await downloadResponse.blob();
    console.log(`Downloaded ${audioBlob.size} bytes`);

    // Create form data for ElevenLabs
    const formData = new FormData();
    formData.append("file", audioBlob, metadata.name || "recording.mp4");
    formData.append("model_id", "scribe_v2");
    formData.append("language_code", "por"); // Portuguese
    formData.append("tag_audio_events", "true");
    formData.append("diarize", "true"); // Speaker labels

    console.log("Sending to ElevenLabs for transcription...");

    const transcriptionResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error("ElevenLabs transcription error:", errorText);
      return new Response(
        JSON.stringify({ error: "Transcription failed: " + errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcriptionResult = await transcriptionResponse.json();
    console.log("Transcription completed");

    // Format the transcription
    let formattedTranscript = "";

    if (transcriptionResult.words && transcriptionResult.words.length > 0) {
      // Group by speaker if diarization is available
      const speakers = new Map<string, string[]>();
      let currentSpeaker = "";
      let currentText: string[] = [];

      for (const word of transcriptionResult.words) {
        const speaker = word.speaker || "Speaker";
        if (speaker !== currentSpeaker) {
          if (currentText.length > 0) {
            if (!speakers.has(currentSpeaker)) {
              speakers.set(currentSpeaker, []);
            }
            formattedTranscript += `**${currentSpeaker}:** ${currentText.join(" ")}\n\n`;
          }
          currentSpeaker = speaker;
          currentText = [];
        }
        currentText.push(word.text);
      }

      // Add last segment
      if (currentText.length > 0) {
        formattedTranscript += `**${currentSpeaker}:** ${currentText.join(" ")}\n\n`;
      }
    }

    // Fallback to raw text if no word-level data
    if (!formattedTranscript && transcriptionResult.text) {
      formattedTranscript = transcriptionResult.text;
    }

    if (!formattedTranscript || formattedTranscript.length < 50) {
      return new Response(
        JSON.stringify({ error: "Transcription returned empty or too short" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save transcription to database
    console.log(`Saving transcript (${formattedTranscript.length} chars) to meeting ${meetingId}`);

    const { error: updateError } = await supabase
      .from("onboarding_meeting_notes")
      .update({ transcript: formattedTranscript })
      .eq("id", meetingId);

    if (updateError) {
      console.error("Failed to save transcript:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save transcription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Transcription saved successfully");

    return new Response(
      JSON.stringify({
        success: true,
        text: formattedTranscript,
        wordCount: formattedTranscript.split(/\s+/).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
