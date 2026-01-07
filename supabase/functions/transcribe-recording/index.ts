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

    // Get the meeting to verify it exists
    const { data: meeting, error: meetingError } = await supabase
      .from("onboarding_meeting_notes")
      .select("*")
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

    // Get Google token for Drive access
    const { data: googleToken } = await supabase
      .from("user_google_tokens")
      .select("access_token, refresh_token")
      .eq("user_id", user.id)
      .single();

    if (!googleToken?.access_token) {
      return new Response(
        JSON.stringify({ error: "Google account not connected. Connect your Google account first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract file ID from Google Drive URL
    const fileIdMatch = recordingUrl.match(/\/d\/([^\/]+)/);
    if (!fileIdMatch) {
      console.log("Could not extract file ID from URL, attempting direct transcription prompt");
      
      // If we can't get the file, use Gemini to explain the situation
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(
          JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // For now, provide a helpful message about manual transcription
      return new Response(
        JSON.stringify({ 
          error: "Não foi possível acessar o arquivo de gravação automaticamente. Verifique se o link do Google Drive está correto e se você tem permissão de acesso." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileId = fileIdMatch[1];
    console.log(`Extracted file ID: ${fileId}`);

    // Download file from Google Drive
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${googleToken.access_token}`,
        },
      }
    );

    if (!driveResponse.ok) {
      // Try to refresh token if expired
      if (driveResponse.status === 401 && googleToken.refresh_token) {
        console.log("Token expired, attempting refresh...");
        
        const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
        const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
        
        const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId!,
            client_secret: clientSecret!,
            refresh_token: googleToken.refresh_token,
            grant_type: "refresh_token",
          }),
        });

        if (refreshResponse.ok) {
          const tokenData = await refreshResponse.json();
          
          // Update stored token
          await supabase
            .from("user_google_tokens")
            .update({ access_token: tokenData.access_token })
            .eq("user_id", user.id);

          // Retry download with new token
          const retryResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
              },
            }
          );

          if (!retryResponse.ok) {
            console.error("Failed to download file after token refresh:", retryResponse.status);
            return new Response(
              JSON.stringify({ error: "Não foi possível baixar o arquivo do Google Drive. Verifique suas permissões." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Continue with retryResponse
          const audioBuffer = await retryResponse.arrayBuffer();
          return await processAudioWithGemini(audioBuffer, meeting, supabase);
        }
      }

      console.error("Failed to download file from Drive:", driveResponse.status);
      const errorText = await driveResponse.text();
      console.error("Drive error:", errorText);
      
      return new Response(
        JSON.stringify({ error: "Não foi possível baixar o arquivo do Google Drive. Verifique se o link está correto e se você tem acesso." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await driveResponse.arrayBuffer();
    console.log(`Downloaded file size: ${audioBuffer.byteLength} bytes`);

    return await processAudioWithGemini(audioBuffer, meeting, supabase);

  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processAudioWithGemini(
  audioBuffer: ArrayBuffer, 
  meeting: any, 
  supabase: any
) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Convert audio to base64
  const base64Audio = btoa(
    String.fromCharCode(...new Uint8Array(audioBuffer.slice(0, 20 * 1024 * 1024))) // Limit to 20MB for API
  );

  console.log("Sending audio to Gemini for transcription...");

  // Use Gemini for transcription via Lovable AI Gateway
  const geminiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Você é um assistente especializado em transcrição de reuniões de negócios. 
Sua tarefa é transcrever o áudio da reunião de forma clara e organizada.

Formato da transcrição:
1. Identifique os participantes quando possível (Participante 1, Participante 2, etc.)
2. Organize a transcrição em parágrafos lógicos
3. Destaque pontos-chave e decisões tomadas
4. No final, adicione um resumo dos principais pontos discutidos

Mantenha a transcrição fiel ao conteúdo, mas remova hesitações excessivas (uhm, ah, etc.) para melhor legibilidade.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Por favor, transcreva esta gravação de reunião: "${meeting.meeting_title}" realizada em ${meeting.meeting_date}. Forneça a transcrição completa seguida de um resumo dos pontos principais.`
            },
            {
              type: "input_audio",
              input_audio: {
                data: base64Audio,
                format: "mp3"
              }
            }
          ]
        }
      ],
    }),
  });

  if (!geminiResponse.ok) {
    const errorData = await geminiResponse.text();
    console.error("Gemini API error:", geminiResponse.status, errorData);
    
    if (geminiResponse.status === 429) {
      return new Response(
        JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (geminiResponse.status === 402) {
      return new Response(
        JSON.stringify({ error: "Créditos insuficientes. Adicione créditos à sua conta Lovable." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Erro ao processar transcrição com IA" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const geminiData = await geminiResponse.json();
  const transcription = geminiData.choices?.[0]?.message?.content;

  if (!transcription) {
    console.error("No transcription in response:", geminiData);
    return new Response(
      JSON.stringify({ error: "Não foi possível gerar a transcrição. O formato do áudio pode não ser suportado." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log("Transcription generated successfully");

  // Update meeting notes with transcription
  const existingNotes = meeting.notes || "";
  const separator = existingNotes ? "\n\n---\n\n" : "";
  const newNotes = existingNotes + separator + "## Transcrição Automática\n\n" + transcription;

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
      message: "Transcrição adicionada às notas da reunião" 
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
