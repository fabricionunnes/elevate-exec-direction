import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshGoogleToken(supabase: any, userId: string, refreshToken: string): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  await supabase.from("user_google_tokens").update({ access_token: data.access_token, token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString() }).eq("user_id", userId);
  return data.access_token;
}

async function uploadToAssemblyAI(fileId: string, accessToken: string, assemblyAiKey: string): Promise<string> {
  const downloadResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!downloadResponse.ok) throw new Error("Não foi possível baixar o arquivo do Google Drive");
  const audioBlob = await downloadResponse.blob();
  const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", { method: "POST", headers: { Authorization: assemblyAiKey, "Content-Type": "application/octet-stream" }, body: audioBlob });
  if (!uploadResponse.ok) throw new Error("Falha no upload para AssemblyAI");
  return (await uploadResponse.json()).upload_url;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { recordingId, staffId, skipTranscription } = await req.json();
    if (!recordingId) return new Response(JSON.stringify({ error: "recordingId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: recording, error: recordingError } = await supabase.from("hotseat_recordings").select("*").eq("id", recordingId).single();
    if (recordingError || !recording) throw new Error("Recording not found");

    let transcriptText = recording.transcript || "";
    const shouldSkip = skipTranscription || (recording.transcript && recording.transcript.length > 50) || recording.recording_link === "manual://transcript";

    if (shouldSkip) {
      if (!transcriptText || transcriptText.length < 50) throw new Error("Transcrição insuficiente");
      await supabase.from("hotseat_recordings").update({ status: "summarizing", error_message: null }).eq("id", recordingId);
    } else {
      if (!ASSEMBLYAI_API_KEY) throw new Error("ASSEMBLYAI_API_KEY not configured");
      await supabase.from("hotseat_recordings").update({ status: "transcribing", error_message: null }).eq("id", recordingId);
      
      const driveMatch = recording.recording_link.match(/drive\.google\.com\/file\/d\/([^/]+)/) || recording.recording_link.match(/drive\.google\.com\/open\?id=([^&]+)/);
      let audioUrl = recording.recording_link;
      
      if (driveMatch && staffId) {
        const { data: staff } = await supabase.from("onboarding_staff").select("user_id").eq("id", staffId).single();
        if (!staff?.user_id) throw new Error("Staff não encontrado");
        const { data: tokenData } = await supabase.from("user_google_tokens").select("access_token, refresh_token, token_expires_at").eq("user_id", staff.user_id).single();
        if (!tokenData) throw new Error("Google não conectado");
        let accessToken = tokenData.access_token;
        if (new Date(tokenData.token_expires_at).getTime() < Date.now()) {
          accessToken = await refreshGoogleToken(supabase, staff.user_id, tokenData.refresh_token);
          if (!accessToken) throw new Error("Sessão do Google expirada");
        }
        audioUrl = await uploadToAssemblyAI(driveMatch[1], accessToken, ASSEMBLYAI_API_KEY);
      }

      const submitResponse = await fetch("https://api.assemblyai.com/v2/transcript", { method: "POST", headers: { Authorization: ASSEMBLYAI_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ audio_url: audioUrl, language_code: "pt", speaker_labels: true }) });
      if (!submitResponse.ok) throw new Error("Falha ao enviar para transcrição");
      const transcriptId = (await submitResponse.json()).id;

      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 10000));
        const pollData = await (await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, { headers: { Authorization: ASSEMBLYAI_API_KEY } })).json();
        if (pollData.status === "completed") { transcriptText = pollData.utterances?.map((u: any) => `Participante ${u.speaker}: ${u.text}`).join("\n\n") || pollData.text || ""; break; }
        if (pollData.status === "error") throw new Error(pollData.error);
      }
      if (!transcriptText) throw new Error("Timeout na transcrição");
      await supabase.from("hotseat_recordings").update({ transcript: transcriptText, transcribed_at: new Date().toISOString(), status: "summarizing" }).eq("id", recordingId);
    }

    const { data: hotseatResponses } = await supabase.from("hotseat_responses").select("company_name, respondent_name, subjects, description").in("status", ["scheduled", "pending"]);
    const companiesContext = hotseatResponses?.map(r => ({ name: r.company_name, respondent: r.respondent_name, subjects: r.subjects })) || [];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: `Analise transcrições de Hotseat. Empresas agendadas: ${JSON.stringify(companiesContext)}` }, { role: "user", content: `Analise e retorne JSON com general_summary, key_insights, companies (name, challenges, recommendations, action_items), next_steps:\n\n${transcriptText}` }], temperature: 0.5 }) });
    
    if (!aiResponse.ok) { await supabase.from("hotseat_recordings").update({ status: "completed", error_message: "Erro ao gerar resumo" }).eq("id", recordingId); return new Response(JSON.stringify({ success: true, warning: "Resumo não gerado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

    let content = (await aiResponse.json()).choices?.[0]?.message?.content || "";
    content = content.replace(/^```json\n?/, "").replace(/\n?```$/, "").replace(/^```\n?/, "").replace(/\n?```$/, "");
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { general_summary: content }; }

    let summary = `## 📊 Resumo Geral\n\n${parsed.general_summary || ""}\n\n`;
    if (parsed.key_insights?.length) { summary += `## 💡 Insights\n\n${parsed.key_insights.map((i: string) => `- ${i}`).join("\n")}\n\n`; }
    if (parsed.companies?.length) { parsed.companies.forEach((c: any) => { summary += `### ${c.name}\n**Desafios:** ${c.challenges?.join(", ") || "N/A"}\n**Recomendações:** ${c.recommendations?.join(", ") || "N/A"}\n**Ações:** ${c.action_items?.join(", ") || "N/A"}\n\n`; }); }

    await supabase.from("hotseat_recordings").update({ summary, companies_mentioned: parsed.companies || [], summarized_at: new Date().toISOString(), status: "completed", error_message: null }).eq("id", recordingId);
    return new Response(JSON.stringify({ success: true, summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error:", error);
    try { const { recordingId } = await req.clone().json(); if (recordingId) { const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!); await sb.from("hotseat_recordings").update({ status: "error", error_message: error instanceof Error ? error.message : "Erro" }).eq("id", recordingId); } } catch {}
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
