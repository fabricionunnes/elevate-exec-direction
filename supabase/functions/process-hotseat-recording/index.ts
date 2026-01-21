import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Refresh Google token if expired
async function refreshGoogleToken(supabase: any, userId: string, refreshToken: string): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  
  if (!clientId || !clientSecret) {
    console.error("Google OAuth credentials not configured");
    return null;
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      console.error("Failed to refresh token:", await response.text());
      return null;
    }

    const data = await response.json();
    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    await supabase
      .from("user_google_tokens")
      .update({
        access_token: data.access_token,
        token_expires_at: newExpiresAt,
      })
      .eq("user_id", userId);

    return data.access_token;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}

// Download file from Google Drive and upload to AssemblyAI
async function uploadToAssemblyAI(fileId: string, accessToken: string, assemblyAiKey: string): Promise<string> {
  console.log("Downloading file from Google Drive...");
  
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const downloadResponse = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!downloadResponse.ok) {
    const errorText = await downloadResponse.text();
    console.error("Drive download error:", errorText);
    throw new Error(`Não foi possível baixar o arquivo do Google Drive: ${downloadResponse.status}`);
  }

  const audioBlob = await downloadResponse.blob();
  console.log(`Downloaded ${audioBlob.size} bytes from Drive`);

  // Upload to AssemblyAI
  console.log("Uploading to AssemblyAI...");
  const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      Authorization: assemblyAiKey,
      "Content-Type": "application/octet-stream",
    },
    body: audioBlob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Falha no upload para AssemblyAI: ${uploadResponse.status}`);
  }

  const uploadData = await uploadResponse.json();
  console.log("Upload complete, URL:", uploadData.upload_url);
  return uploadData.upload_url;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recordingId, staffId } = await req.json();

    if (!recordingId) {
      return new Response(
        JSON.stringify({ error: "recordingId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!ASSEMBLYAI_API_KEY) {
      throw new Error("ASSEMBLYAI_API_KEY is not configured");
    }
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch recording details
    const { data: recording, error: recordingError } = await supabase
      .from("hotseat_recordings")
      .select("*")
      .eq("id", recordingId)
      .single();

    if (recordingError || !recording) {
      throw new Error("Recording not found");
    }

    const recordingLink = recording.recording_link;

    // Update status to transcribing
    await supabase
      .from("hotseat_recordings")
      .update({ status: "transcribing", error_message: null })
      .eq("id", recordingId);

    // Extract Google Drive file ID
    const driveMatch = recordingLink.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    const driveOpenMatch = recordingLink.match(/drive\.google\.com\/open\?id=([^&]+)/);
    const fileId = driveMatch?.[1] || driveOpenMatch?.[1];

    let audioUrl = recordingLink;

    if (fileId && staffId) {
      console.log("Google Drive file detected, ID:", fileId);

      // Get staff's user_id
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("user_id")
        .eq("id", staffId)
        .single();

      if (!staff?.user_id) {
        throw new Error("Staff não encontrado");
      }

      // Get Google tokens
      const { data: tokenData } = await supabase
        .from("user_google_tokens")
        .select("access_token, refresh_token, token_expires_at")
        .eq("user_id", staff.user_id)
        .single();

      if (!tokenData) {
        throw new Error("Google não conectado. Conecte o Google Calendar nas configurações.");
      }

      let accessToken = tokenData.access_token;
      const expiresAt = new Date(tokenData.token_expires_at).getTime();
      
      if (expiresAt < Date.now()) {
        console.log("Token expired, refreshing...");
        accessToken = await refreshGoogleToken(supabase, staff.user_id, tokenData.refresh_token);
        if (!accessToken) {
          throw new Error("Sessão do Google expirada. Reconecte o Google Calendar.");
        }
      }

      // Upload to AssemblyAI from Drive
      audioUrl = await uploadToAssemblyAI(fileId, accessToken, ASSEMBLYAI_API_KEY);
    }

    // Step 1: Submit for transcription
    console.log("Submitting to AssemblyAI for transcription...");
    const submitResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: "pt",
        speaker_labels: true,
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`Falha ao enviar para transcrição: ${errorText}`);
    }

    const submitData = await submitResponse.json();
    const transcriptId = submitData.id;
    console.log("Transcription submitted, ID:", transcriptId);

    // Step 2: Poll for completion
    let attempts = 0;
    const maxAttempts = 120; // 20 minutes max
    let transcriptText = "";

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
      attempts++;

      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { Authorization: ASSEMBLYAI_API_KEY },
      });

      const pollData = await pollResponse.json();
      console.log(`Poll attempt ${attempts}: status = ${pollData.status}`);

      if (pollData.status === "completed") {
        // Format transcript with speaker labels
        if (pollData.utterances && pollData.utterances.length > 0) {
          transcriptText = pollData.utterances
            .map((u: any) => `Participante ${u.speaker}: ${u.text}`)
            .join("\n\n");
        } else {
          transcriptText = pollData.text || "";
        }
        break;
      } else if (pollData.status === "error") {
        throw new Error(`Erro na transcrição: ${pollData.error}`);
      }
    }

    if (!transcriptText) {
      throw new Error("Transcrição excedeu o tempo limite");
    }

    console.log(`Transcription complete: ${transcriptText.length} characters`);

    // Update with transcript
    await supabase
      .from("hotseat_recordings")
      .update({ 
        transcript: transcriptText, 
        transcribed_at: new Date().toISOString(),
        status: "summarizing" 
      })
      .eq("id", recordingId);

    // Fetch all scheduled/pending hotseat responses for context
    const { data: hotseatResponses } = await supabase
      .from("hotseat_responses")
      .select(`
        id, respondent_name, company_name, subjects, description, status,
        linked_company_id, linked_project_id
      `)
      .in("status", ["scheduled", "pending"])
      .order("created_at", { ascending: true });

    // Build context of companies
    const companiesContext = hotseatResponses?.map(r => ({
      name: r.company_name,
      respondent: r.respondent_name,
      subjects: r.subjects,
      description: r.description,
    })) || [];

    // Step 3: Generate AI summary
    console.log("Generating AI summary...");
    
    const systemPrompt = `Você é um assistente especializado em análise de reuniões de Hotseat.
O Hotseat é uma reunião onde vários empresários apresentam seus desafios e recebem orientações.

Sua tarefa é:
1. Identificar cada empresa/empresário mencionado na transcrição
2. Resumir os pontos principais discutidos para cada empresa
3. Listar as orientações e ações recomendadas para cada uma
4. Destacar insights gerais da reunião

EMPRESAS AGENDADAS PARA ESTE HOTSEAT:
${JSON.stringify(companiesContext, null, 2)}

IMPORTANTE:
- Use os nomes das empresas/pessoas do contexto quando possível
- Se houver empresas na transcrição que não estão na lista, inclua-as também
- Seja objetivo e prático nas recomendações`;

    const userPrompt = `Analise a seguinte transcrição do Hotseat e gere um resumo estruturado:

${transcriptText}

Retorne um JSON no seguinte formato (retorne APENAS o JSON, sem markdown):
{
  "general_summary": "Resumo geral da reunião em 2-3 parágrafos",
  "key_insights": ["Insight 1", "Insight 2", "Insight 3"],
  "companies": [
    {
      "name": "Nome da Empresa",
      "respondent": "Nome do Empresário",
      "challenges": ["Desafio 1", "Desafio 2"],
      "recommendations": ["Recomendação 1", "Recomendação 2"],
      "action_items": ["Ação 1", "Ação 2"]
    }
  ],
  "next_steps": ["Próximo passo geral 1", "Próximo passo geral 2"]
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI error:", await aiResponse.text());
      // Still save transcript even if summary fails
      await supabase
        .from("hotseat_recordings")
        .update({ 
          status: "completed",
          error_message: "Transcrição concluída, mas erro ao gerar resumo"
        })
        .eq("id", recordingId);

      return new Response(JSON.stringify({ 
        success: true, 
        transcript: transcriptText,
        warning: "Resumo não pôde ser gerado"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    let parsedSummary;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.replace(/^```\n?/, "").replace(/\n?```$/, "");
      }
      parsedSummary = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      parsedSummary = { general_summary: content, companies: [] };
    }

    // Build markdown summary
    let summaryMarkdown = `## 📊 Resumo Geral\n\n${parsedSummary.general_summary || ""}\n\n`;

    if (parsedSummary.key_insights?.length > 0) {
      summaryMarkdown += `## 💡 Insights Principais\n\n`;
      parsedSummary.key_insights.forEach((insight: string) => {
        summaryMarkdown += `- ${insight}\n`;
      });
      summaryMarkdown += "\n";
    }

    if (parsedSummary.companies?.length > 0) {
      summaryMarkdown += `## 🏢 Por Empresa\n\n`;
      parsedSummary.companies.forEach((company: any) => {
        summaryMarkdown += `### ${company.name}`;
        if (company.respondent) summaryMarkdown += ` (${company.respondent})`;
        summaryMarkdown += "\n\n";

        if (company.challenges?.length > 0) {
          summaryMarkdown += `**Desafios:**\n`;
          company.challenges.forEach((c: string) => summaryMarkdown += `- ${c}\n`);
          summaryMarkdown += "\n";
        }

        if (company.recommendations?.length > 0) {
          summaryMarkdown += `**Recomendações:**\n`;
          company.recommendations.forEach((r: string) => summaryMarkdown += `- ${r}\n`);
          summaryMarkdown += "\n";
        }

        if (company.action_items?.length > 0) {
          summaryMarkdown += `**Ações:**\n`;
          company.action_items.forEach((a: string) => summaryMarkdown += `- ✅ ${a}\n`);
          summaryMarkdown += "\n";
        }
      });
    }

    if (parsedSummary.next_steps?.length > 0) {
      summaryMarkdown += `## 🎯 Próximos Passos\n\n`;
      parsedSummary.next_steps.forEach((step: string) => {
        summaryMarkdown += `- ${step}\n`;
      });
    }

    // Update final result
    await supabase
      .from("hotseat_recordings")
      .update({ 
        summary: summaryMarkdown,
        companies_mentioned: parsedSummary.companies || [],
        summarized_at: new Date().toISOString(),
        status: "completed",
        error_message: null
      })
      .eq("id", recordingId);

    console.log("Process complete!");

    return new Response(JSON.stringify({ 
      success: true,
      transcript: transcriptText,
      summary: summaryMarkdown,
      companies: parsedSummary.companies
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error processing hotseat recording:", error);
    
    // Try to update error status
    try {
      const { recordingId } = await req.clone().json();
      if (recordingId) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase
          .from("hotseat_recordings")
          .update({ 
            status: "error",
            error_message: error instanceof Error ? error.message : "Erro desconhecido"
          })
          .eq("id", recordingId);
      }
    } catch (e) {
      console.error("Failed to update error status:", e);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
