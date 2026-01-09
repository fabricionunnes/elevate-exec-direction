import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Maximum file size per chunk for ElevenLabs (20MB to stay under 25MB limit)
const MAX_CHUNK_SIZE = 20 * 1024 * 1024;
// Maximum total file size we'll attempt to process (500MB)
const MAX_TOTAL_SIZE = 500 * 1024 * 1024;

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

    // Determine whose Google token to use for Drive access
    let targetUserId = user.id;
    
    const project = meeting.project as { consultant_id?: string; onboarding_company_id?: string } | null;
    let consultantStaffId = project?.consultant_id;
    
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

    // Get Google token for Drive access
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
      
      // Check maximum total size
      if (fileSize > MAX_TOTAL_SIZE) {
        const fileSizeMB = Math.round(fileSize / 1024 / 1024);
        console.error(`File too large: ${fileSize} bytes (max: ${MAX_TOTAL_SIZE})`);
        return new Response(
          JSON.stringify({
            error: `O arquivo de gravação é muito grande (${fileSizeMB}MB). O limite máximo é 500MB.\n\nRecomendamos:\n\n• Exportar/baixar apenas o áudio (MP3)\n• Comprimir ou dividir a gravação em partes menores\n• Usar uma ferramenta externa de transcrição e colar o texto nas notas`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`File size: ${Math.round(fileSize / 1024 / 1024)}MB`);
      
      if (metadata.capabilities?.canDownload === false) {
        return new Response(
          JSON.stringify({ error: "Você não tem permissão para baixar este arquivo. Verifique as configurações de compartilhamento no Google Drive." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Refresh token helper function
    const refreshAccessToken = async (): Promise<string | null> => {
      if (!activeToken?.refresh_token) return null;
      
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
        await supabase
          .from("user_google_tokens")
          .update({ access_token: tokenData.access_token })
          .eq("user_id", tokenOwnerId);
        activeToken.access_token = tokenData.access_token;
        return tokenData.access_token;
      }
      return null;
    };

    // Download file with retry on 401
    const downloadFile = async (): Promise<ArrayBuffer> => {
      let driveResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
        {
          headers: {
            Authorization: `Bearer ${activeToken!.access_token}`,
          },
        }
      );

      // Try webContentLink if 403
      if (driveResponse.status === 403) {
        console.log("Got 403, trying webContentLink approach...");
        const linkResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webContentLink&supportsAllDrives=true`,
          {
            headers: {
              Authorization: `Bearer ${activeToken!.access_token}`,
            },
          }
        );
        
        if (linkResponse.ok) {
          const linkData = await linkResponse.json();
          if (linkData.webContentLink) {
            driveResponse = await fetch(linkData.webContentLink, {
              headers: {
                Authorization: `Bearer ${activeToken!.access_token}`,
              },
              redirect: "follow",
            });
          }
        }
      }

      // Refresh token if expired
      if (driveResponse.status === 401) {
        console.log("Token expired, attempting refresh...");
        const newToken = await refreshAccessToken();
        if (newToken) {
          driveResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
            {
              headers: {
                Authorization: `Bearer ${newToken}`,
              },
            }
          );
        }
      }

      if (!driveResponse.ok) {
        throw new Error(`Failed to download file: ${driveResponse.status}`);
      }

      return await driveResponse.arrayBuffer();
    };

    console.log("Starting file download...");
    let fileBuffer: ArrayBuffer;
    
    try {
      fileBuffer = await downloadFile();
      console.log(`Downloaded ${fileBuffer.byteLength} bytes`);
    } catch (error) {
      console.error("Download error:", error);
      return new Response(
        JSON.stringify({ 
          error: "Não foi possível baixar o arquivo do Google Drive. Isso pode acontecer se a gravação do Meet ainda não estiver disponível ou se você não tem permissão de download. Aguarde alguns minutos e tente novamente." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process file - either as single chunk or multiple chunks
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let transcription = "";
    
    if (fileBuffer.byteLength <= MAX_CHUNK_SIZE) {
      // Single chunk processing
      console.log("Processing as single chunk...");
      transcription = await transcribeChunk(new Uint8Array(fileBuffer), fileName, mimeType, ELEVENLABS_API_KEY);
    } else {
      // Multi-chunk processing
      const numChunks = Math.ceil(fileBuffer.byteLength / MAX_CHUNK_SIZE);
      console.log(`File is ${Math.round(fileBuffer.byteLength / 1024 / 1024)}MB - splitting into ${numChunks} chunks for processing...`);
      
      const transcriptions: string[] = [];
      
      for (let i = 0; i < numChunks; i++) {
        const start = i * MAX_CHUNK_SIZE;
        const end = Math.min(start + MAX_CHUNK_SIZE, fileBuffer.byteLength);
        const chunk = new Uint8Array(fileBuffer.slice(start, end));
        
        console.log(`Processing chunk ${i + 1}/${numChunks} (${Math.round(chunk.byteLength / 1024 / 1024)}MB)...`);
        
        try {
          const chunkTranscription = await transcribeChunk(
            chunk, 
            `${fileName}_part${i + 1}`, 
            mimeType, 
            ELEVENLABS_API_KEY
          );
          
          if (chunkTranscription) {
            transcriptions.push(chunkTranscription);
          }
        } catch (error) {
          console.error(`Error processing chunk ${i + 1}:`, error);
          // Continue with other chunks even if one fails
        }
      }
      
      if (transcriptions.length === 0) {
        return new Response(
          JSON.stringify({ error: "Não foi possível transcrever nenhuma parte do arquivo." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Combine all transcriptions
      transcription = transcriptions.join("\n\n---\n\n");
      console.log(`Successfully transcribed ${transcriptions.length}/${numChunks} chunks`);
    }

    if (!transcription) {
      return new Response(
        JSON.stringify({ error: "Não foi possível gerar a transcrição. O formato do áudio pode não ser suportado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Transcription generated successfully");

    // Update meeting notes
    const existingNotes = meeting.notes || "";
    const separator = existingNotes ? "\n\n---\n\n" : "";
    const newNotes = existingNotes + separator + "## Transcrição Automática (ElevenLabs)\n\n" + transcription;

    const { error: updateError } = await supabase
      .from("onboarding_meeting_notes")
      .update({ notes: newNotes })
      .eq("id", meeting.id);

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

  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function transcribeChunk(
  audioData: Uint8Array,
  fileName: string,
  mimeType: string,
  apiKey: string
): Promise<string> {
  const formData = new FormData();
  // Create a new ArrayBuffer copy to satisfy TypeScript's type requirements
  const buffer = new ArrayBuffer(audioData.byteLength);
  new Uint8Array(buffer).set(audioData);
  const blob = new Blob([buffer], { type: mimeType });
  formData.append("file", blob, fileName);
  formData.append("language_code", "por");
  formData.append("diarize", "true");
  formData.append("tag_audio_events", "true");

  console.log(`Sending ${Math.round(audioData.byteLength / 1024 / 1024)}MB to ElevenLabs...`);

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("ElevenLabs API error:", response.status, errorText);
    
    if (response.status === 401) {
      throw new Error("Chave da API ElevenLabs inválida.");
    }
    if (response.status === 429) {
      throw new Error("Limite de requisições excedido. Tente novamente em alguns minutos.");
    }
    throw new Error(`ElevenLabs error: ${response.status}`);
  }

  const data = await response.json();
  console.log("ElevenLabs response received:", JSON.stringify(data).substring(0, 300));

  let transcription = data.text || "";

  // Format with speakers if available
  if (data.words && data.words.length > 0) {
    const formatted = formatTranscriptionWithSpeakers(data);
    if (formatted) {
      transcription = formatted;
    }
  }

  return transcription;
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
      if (currentText.trim()) {
        result += `**${currentSpeaker}:** ${currentText.trim()}\n\n`;
      }
      currentSpeaker = speaker;
      currentText = word.text + " ";
    } else {
      currentText += word.text + " ";
    }
  }

  if (currentText.trim()) {
    result += `**${currentSpeaker}:** ${currentText.trim()}\n\n`;
  }

  return result.trim() || null;
}
