import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Receives call status webhooks from Twilio (fire-and-forget)
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  try {
    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const callStatus = formData.get("CallStatus") as string;
    const duration = formData.get("CallDuration") as string;

    console.log(`Call ${callSid}: status=${callStatus}, duration=${duration}s`);
  } catch (e) {
    console.error("Error processing call status:", e);
  }

  return new Response("OK", { status: 200 });
});
