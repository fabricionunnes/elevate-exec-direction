import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { meetingId, recordingUrl } = await req.json();
    
    if (!meetingId || !recordingUrl) {
      return new Response(
        JSON.stringify({ error: "meetingId and recordingUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting transcription for meeting ${meetingId}`);
    console.log(`Recording URL: ${recordingUrl}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the meeting to verify it exists and get project info
    const { data: meeting, error: meetingError } = await supabase
      .from("onboarding_meeting_notes")
      .select("*, project:project_id(consultant_id, onboarding_company_id)")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      console.error("Meeting not found:", meetingError);
      return new Response(
        JSON.stringify({ error: "Meeting not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's Google token to access Drive files
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine whose Google token to use for Drive access:
    // Priority: 1) Project consultant (owner of recordings), 2) Current user
    let targetUserId = user.id;
    
    // Get project consultant's user_id if available
    const project = meeting.project as { consultant_id?: string; onboarding_company_id?: string } | null;
    let consultantStaffId = project?.consultant_id;
    
    // If no project-level consultant, try company-level
    if (!consultantStaffId && project?.onboarding_company_id) {
      const { data: company } = await supabase
        .from("onboarding_companies")
        .select("consultant_id")
        .eq("id", project.onboarding_company_id)
        .single();
      
      if (company?.consultant_id) {
        consultantStaffId = company.consultant_id;
      }
    }
    
    // Get consultant's user_id
    if (consultantStaffId) {
      const { data: consultant } = await supabase
        .from("onboarding_staff")
        .select("user_id")
        .eq("id", consultantStaffId)
        .single();
      
      if (consultant?.user_id) {
        targetUserId = consultant.user_id;
        console.log(`Using consultant's Google token (user_id: ${targetUserId})`);
      }
    }

    // Get Google token for Drive access (from consultant or current user)
    let activeToken: { access_token: string; refresh_token: string | null; user_id: string } | null = null;
    
    const { data: googleToken } = await supabase
      .from("user_google_tokens")
      .select("access_token, refresh_token, user_id")
      .eq("user_id", targetUserId)
      .single();

    if (googleToken?.access_token) {
      activeToken = {
        access_token: googleToken.access_token,
        refresh_token: googleToken.refresh_token || null,
        user_id: googleToken.user_id || targetUserId,
      };
    } else if (targetUserId !== user.id) {
      // Fallback: try current user's token if consultant doesn't have one
      console.log("Consultant token not found, falling back to current user's token");
      const { data: fallbackToken } = await supabase
        .from("user_google_tokens")
        .select("access_token, refresh_token, user_id")
        .eq("user_id", user.id)
        .single();
      
      if (fallbackToken?.access_token) {
        activeToken = {
          access_token: fallbackToken.access_token,
          refresh_token: fallbackToken.refresh_token || null,
          user_id: fallbackToken.user_id || user.id,
        };
      }
    }

    if (!activeToken) {
      return new Response(
        JSON.stringify({ error: "Google account not connected. Connect your Google account first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Store the token owner's user_id for potential refresh
    const tokenOwnerId = activeToken.user_id;

    // Extract file ID from Google Drive URL
    const fileIdMatch = recordingUrl.match(/\/d\/([^\/]+)/);
    if (!fileIdMatch) {
      console.log("Could not extract file ID from URL");
      return new Response(
        JSON.stringify({ 
          error: "Não foi possível acessar o arquivo de gravação automaticamente. Verifique se o link do Google Drive está correto e se você tem permissão de acesso." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileId = fileIdMatch[1];
    console.log(`Extracted file ID: ${fileId}`);

    // Get file metadata
    console.log("Fetching file metadata...");
    const metadataResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size,capabilities&supportsAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${activeToken.access_token}`,
        },
      }
    );

    let fileSize = 0;
    let mimeType = "video/mp4";
    let fileName = "recording";
    
    if (metadataResponse.ok) {
      const metadata = await metadataResponse.json();
      console.log("File metadata:", JSON.stringify(metadata, null, 2));
      fileSize = parseInt(metadata.size || "0", 10);
      mimeType = metadata.mimeType || "video/mp4";
      fileName = metadata.name || "recording";
      
      // Limit due to backend function runtime/memory constraints
      const maxFileSize = 25 * 1024 * 1024; // 25MB
      if (fileSize > maxFileSize) {
        const fileSizeMB = Math.round(fileSize / 1024 / 1024);
        console.error(`File too large: ${fileSize} bytes (max: ${maxFileSize})`);
        return new Response(
          JSON.stringify({
            error:
              `O arquivo de gravação é muito grande (${fileSizeMB}MB). O limite para transcrição automática é de 25MB.\n\nPara arquivos maiores, use o botão "Colar Transcrição" no painel de reunião para adicionar a transcrição manualmente.`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(
        `File size: ${Math.round(fileSize / 1024 / 1024)}MB - proceeding with download...`
      );
      if (metadata.capabilities?.canDownload === false) {
        return new Response(
          JSON.stringify({ error: "Você não tem permissão para baixar este arquivo. Verifique as configurações de compartilhamento no Google Drive." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log("Starting file download...");
    
    // Try to download file from Google Drive
    let driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${activeToken.access_token}`,
        },
      }
    );

    // If 403, try webContentLink approach
    if (driveResponse.status === 403) {
      console.log("Got 403, trying webContentLink approach...");
      
      const linkResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webContentLink&supportsAllDrives=true`,
        {
          headers: {
            Authorization: `Bearer ${activeToken.access_token}`,
          },
        }
      );
      
      if (linkResponse.ok) {
        const linkData = await linkResponse.json();
        console.log("File links:", JSON.stringify(linkData, null, 2));
        
        if (linkData.webContentLink) {
          driveResponse = await fetch(linkData.webContentLink, {
            headers: {
              Authorization: `Bearer ${activeToken.access_token}`,
            },
            redirect: "follow",
          });
        }
      }
    }

    if (!driveResponse.ok) {
      // Try to refresh token if expired
      if (driveResponse.status === 401 && activeToken.refresh_token) {
        console.log("Token expired, attempting refresh...");
        
        const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
        const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
        
        const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId!,
            client_secret: clientSecret!,
            refresh_token: activeToken.refresh_token,
            grant_type: "refresh_token",
          }),
        });

        if (refreshResponse.ok) {
          const tokenData = await refreshResponse.json();
          
          // Update stored token using the token owner's ID
          await supabase
            .from("user_google_tokens")
            .update({ access_token: tokenData.access_token })
            .eq("user_id", tokenOwnerId);
          
          // Update activeToken for subsequent use
          activeToken.access_token = tokenData.access_token;

          // Retry download with new token
          driveResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
            {
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
              },
            }
          );

          if (!driveResponse.ok) {
            console.error("Failed to download file after token refresh:", driveResponse.status);
            return new Response(
              JSON.stringify({ error: "Não foi possível baixar o arquivo do Google Drive. Verifique suas permissões." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } else {
        console.error("Failed to download file from Drive:", driveResponse.status);
        const errorText = await driveResponse.text();
        console.error("Drive error:", errorText);
        
        return new Response(
          JSON.stringify({ 
            error: "Não foi possível baixar o arquivo do Google Drive. Isso pode acontecer se a gravação do Meet ainda não estiver disponível ou se você não tem permissão de download. Aguarde alguns minutos e tente novamente." 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!driveResponse.body) {
      console.error("Drive response has no body stream");
      return new Response(
        JSON.stringify({ error: "Não foi possível ler o arquivo de gravação." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Streaming download to ElevenLabs (${Math.round(fileSize / 1024 / 1024)}MB)...`);

    return await processDriveStreamWithElevenLabs({
      driveStream: driveResponse.body,
      meeting,
      supabase,
      fileName,
      mimeType,
      fileSize,
    });

  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

type ElevenLabsStreamInput = {
  driveStream: ReadableStream<Uint8Array>;
  meeting: any;
  supabase: any;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

async function processDriveStreamWithElevenLabs(input: ElevenLabsStreamInput) {
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  if (!ELEVENLABS_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`Processing audio with ElevenLabs STT via stream (${input.fileSize} bytes)...`);

  const boundary = `----lovable-elevenlabs-${crypto.randomUUID()}`;
  const encoder = new TextEncoder();

  const fieldPart = (name: string, value: string) =>
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
    `${value}\r\n`;

  const fileHeader =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${escapeQuotes(input.fileName)}"\r\n` +
    `Content-Type: ${input.mimeType || "application/octet-stream"}\r\n\r\n`;

  const closing = `\r\n--${boundary}--\r\n`;

  const prefix =
    fieldPart("model_id", "scribe_v1") +
    fieldPart("language_code", "por") +
    fieldPart("diarize", "true") +
    fieldPart("tag_audio_events", "true") +
    fileHeader;

  const multipartStream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      try {
        controller.enqueue(encoder.encode(prefix));

        const reader = input.driveStream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }

        controller.enqueue(encoder.encode(closing));
        controller.close();
      } catch (e) {
        console.error("Error streaming multipart body:", e);
        controller.error(e);
      }
    },
  });

  console.log("Sending stream to ElevenLabs Speech-to-Text API...");

  const elevenLabsResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartStream,
  });

  if (!elevenLabsResponse.ok) {
    const errorText = await elevenLabsResponse.text();
    console.error("ElevenLabs API error:", elevenLabsResponse.status, errorText);

    if (elevenLabsResponse.status === 401) {
      return new Response(
        JSON.stringify({ error: "Chave da API ElevenLabs inválida. Verifique a configuração." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (elevenLabsResponse.status === 429) {
      return new Response(
        JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Erro ao processar transcrição com ElevenLabs" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const transcriptionData = await elevenLabsResponse.json();
  console.log(
    "ElevenLabs response received:",
    JSON.stringify(transcriptionData).substring(0, 500)
  );

  let transcription = transcriptionData.text || "";

  if (!transcription) {
    console.error("No transcription in response:", transcriptionData);
    return new Response(
      JSON.stringify({ error: "Não foi possível gerar a transcrição. O formato do áudio pode não ser suportado." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (transcriptionData.words && transcriptionData.words.length > 0) {
    const formattedTranscription = formatTranscriptionWithSpeakers(transcriptionData);
    if (formattedTranscription) {
      transcription = formattedTranscription;
    }
  }

  console.log("Transcription generated successfully");

  const existingNotes = input.meeting.notes || "";
  const separator = existingNotes ? "\n\n---\n\n" : "";
  const newNotes =
    existingNotes + separator + "## Transcrição Automática (ElevenLabs)\n\n" + transcription;

  const { error: updateError } = await input.supabase
    .from("onboarding_meeting_notes")
    .update({ notes: newNotes })
    .eq("id", input.meeting.id);

  if (updateError) {
    console.error("Error updating meeting notes:", updateError);
    return new Response(
      JSON.stringify({ error: "Transcrição gerada mas erro ao salvar. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      transcription,
      message: "Transcrição adicionada às notas da reunião",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function escapeQuotes(s: string) {
  return s.replaceAll("\"", "'");
}


function formatTranscriptionWithSpeakers(data: any): string | null {
  if (!data.words || data.words.length === 0) {
    return null;
  }

  let result = "";
  let currentSpeaker = "";
  let currentText = "";

  for (const word of data.words) {
    const speaker = word.speaker || "Participante";
    
    if (speaker !== currentSpeaker) {
      // Save previous speaker's text
      if (currentText.trim()) {
        result += `**${currentSpeaker}:** ${currentText.trim()}\n\n`;
      }
      currentSpeaker = speaker;
      currentText = word.text + " ";
    } else {
      currentText += word.text + " ";
    }
  }

  // Add last speaker's text
  if (currentText.trim()) {
    result += `**${currentSpeaker}:** ${currentText.trim()}\n\n`;
  }

  return result.trim() || null;
}
