import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

// Helper function to validate UUID format
function isValidUUID(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for webhook access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log("Received Tactiq webhook payload:", JSON.stringify(body).substring(0, 1000));

    // Tactiq webhook payload structure (via Zapier or direct)
    // The structure can vary, so we handle multiple formats
    const {
      // Standard Tactiq fields
      meeting_id,
      meetingId,
      meeting_url,
      meetingUrl,
      meeting_title,
      meetingTitle,
      title,
      transcript,
      transcription,
      text,
      summary,
      highlights,
      speakers,
      duration,
      duration_seconds,
      durationSeconds,
      recorded_at,
      recordedAt,
      date,
      // Custom fields for linking
      lead_id,
      leadId,
      lead_name,
      leadName,
      project_id,
      projectId,
      meeting_event_id,
      meetingEventId,
    } = body;

    // Validate and extract lead_id - only use if it's a valid UUID
    const rawLeadId = lead_id || leadId || null;
    const rawLeadName = lead_name || leadName || null;

    // Normalize the data - validate UUID before using lead_id
    const normalizedData = {
      source_meeting_id: meeting_id || meetingId || null,
      source_meeting_url: meeting_url || meetingUrl || null,
      title: meeting_title || meetingTitle || title || "Transcrição Tactiq",
      transcription_text: transcript || transcription || text || null,
      summary: summary || null,
      highlights: Array.isArray(highlights) ? highlights : [],
      speakers: Array.isArray(speakers) ? speakers : [],
      duration_seconds: duration_seconds || durationSeconds || (duration ? Math.floor(duration * 60) : null),
      recorded_at: recorded_at || recordedAt || date || new Date().toISOString(),
      lead_id: isValidUUID(rawLeadId) ? rawLeadId : null,
      lead_name_hint: !isValidUUID(rawLeadId) && rawLeadId ? rawLeadId : rawLeadName, // Use invalid UUID as name hint
      project_id: project_id || projectId || null,
      meeting_event_id: meeting_event_id || meetingEventId || null,
    };

    console.log(`Lead ID validation: raw="${rawLeadId}", isValid=${isValidUUID(rawLeadId)}, nameHint="${normalizedData.lead_name_hint}"`);

    // Validate required fields
    if (!normalizedData.transcription_text) {
      console.error("Missing transcription text in payload");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Transcrição não encontrada no payload. Verifique a configuração do Zapier/Tactiq." 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // If we have a meeting URL, try to find the lead by matching meeting events
    let linkedLeadId = normalizedData.lead_id;
    let linkedMeetingEventId = normalizedData.meeting_event_id;
    let linkedProjectId = normalizedData.project_id;

    // If lead_id is not set but we have a name hint, try to find the lead by name
    if (!linkedLeadId && normalizedData.lead_name_hint) {
      console.log(`Attempting to find lead by name hint: "${normalizedData.lead_name_hint}"`);
      const { data: leadByName } = await supabase
        .from("crm_leads")
        .select("id, pipeline_id")
        .ilike("name", `%${normalizedData.lead_name_hint}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leadByName) {
        linkedLeadId = leadByName.id;
        console.log(`Found lead by name hint: ${leadByName.id}`);
        
        // Also get project_id from this lead's pipeline
        if (leadByName.pipeline_id && !linkedProjectId) {
          const { data: pipeline } = await supabase
            .from("crm_pipelines")
            .select("project_id")
            .eq("id", leadByName.pipeline_id)
            .single();

          if (pipeline?.project_id) {
            linkedProjectId = pipeline.project_id;
          }
        }
      } else {
        console.log(`No lead found matching name hint: "${normalizedData.lead_name_hint}"`);
      }
    }

    if (normalizedData.source_meeting_url && !linkedLeadId) {
      // Try to find a meeting event with this URL
      const { data: meetingEvent } = await supabase
        .from("crm_meeting_events")
        .select("id, lead_id, staff_id")
        .or(`meeting_url.ilike.%${normalizedData.source_meeting_url}%,external_meeting_url.ilike.%${normalizedData.source_meeting_url}%`)
        .order("scheduled_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (meetingEvent) {
        linkedMeetingEventId = meetingEvent.id;
        linkedLeadId = meetingEvent.lead_id;
        console.log(`Found matching meeting event: ${meetingEvent.id} for lead: ${meetingEvent.lead_id}`);
      }
    }

    // Get project_id from lead if we have a lead
    if (linkedLeadId && !linkedProjectId) {
      const { data: lead } = await supabase
        .from("crm_leads")
        .select("pipeline_id")
        .eq("id", linkedLeadId)
        .single();

      if (lead?.pipeline_id) {
        const { data: pipeline } = await supabase
          .from("crm_pipelines")
          .select("project_id")
          .eq("id", lead.pipeline_id)
          .single();

        if (pipeline?.project_id) {
          linkedProjectId = pipeline.project_id;
        }
      }
    }

    // Create the transcription record
    const { data: transcriptionRecord, error: insertError } = await supabase
      .from("crm_transcriptions")
      .insert({
        lead_id: linkedLeadId,
        meeting_event_id: linkedMeetingEventId,
        project_id: linkedProjectId,
        title: normalizedData.title,
        transcription_text: normalizedData.transcription_text,
        summary: normalizedData.summary,
        source: "tactiq",
        source_meeting_id: normalizedData.source_meeting_id,
        source_meeting_url: normalizedData.source_meeting_url,
        duration_seconds: normalizedData.duration_seconds,
        language: "pt-BR",
        speakers: normalizedData.speakers,
        highlights: normalizedData.highlights,
        status: "completed",
        recorded_at: normalizedData.recorded_at,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting transcription:", insertError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao salvar transcrição: ${insertError.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`Transcription saved successfully: ${transcriptionRecord.id}`);

    // Create an activity for the lead if linked
    if (linkedLeadId) {
      await supabase.from("crm_activities").insert({
        lead_id: linkedLeadId,
        type: "meeting",
        title: `Transcrição recebida: ${normalizedData.title}`,
        description: normalizedData.summary || "Transcrição da reunião processada via Tactiq",
        status: "completed",
        completed_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        transcription_id: transcriptionRecord.id,
        lead_id: linkedLeadId,
        meeting_event_id: linkedMeetingEventId,
        message: "Transcrição salva com sucesso",
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Tactiq webhook error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
