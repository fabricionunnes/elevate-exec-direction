import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// This function serves TwiML XML to Twilio when a call is answered.
// It tells Twilio to connect (dial) the lead's phone number.
serve(async (req) => {
  const url = new URL(req.url);
  const leadPhone = url.searchParams.get("lead_phone");

  if (!leadPhone) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="pt-BR">Número do lead não informado. Encerrando.</Say>
  <Hangup/>
</Response>`,
      { headers: { "Content-Type": "application/xml" } }
    );
  }

  const callerIdPhone = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="pt-BR">Conectando à ligação.</Say>
  <Dial callerId="${callerIdPhone}" record="record-from-answer-dual" recordingStatusCallback="${url.origin}/functions/v1/twilio-recording-callback">
    <Number>${leadPhone}</Number>
  </Dial>
</Response>`;

  return new Response(twiml, {
    headers: { "Content-Type": "application/xml" },
  });
});
