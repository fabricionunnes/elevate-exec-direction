import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Receives recording status callbacks from Twilio
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  try {
    const formData = await req.formData();
    const recordingSid = formData.get("RecordingSid") as string;
    const recordingUrl = formData.get("RecordingUrl") as string;
    const callSid = formData.get("CallSid") as string;
    const duration = formData.get("RecordingDuration") as string;

    console.log(`Recording ${recordingSid} for call ${callSid}: url=${recordingUrl}, duration=${duration}s`);

    // Future: save recording URL to database
  } catch (e) {
    console.error("Error processing recording callback:", e);
  }

  return new Response("OK", { status: 200 });
});
