// dialer-agent-twiml: TwiML que a perna da ATENDENTE executa pra entrar na conferência
// da ligação. Usado só quando a campanha tem monitoria ligada (enable_monitoring).
// A perna da atendente é originada pelo dialer-twiml (REST) com To=client:agent-{staffId}.
function twiml(xml: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${xml}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}
function xmlEscape(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

Deno.serve((req) => {
  const url = new URL(req.url);
  const conf = url.searchParams.get("conf") || "";
  if (!conf) return twiml(`<Hangup/>`);
  // A atendente entra na conferência. endConferenceOnExit=true: se ela cair, a ligação acaba.
  return twiml(
    `<Dial>` +
      `<Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false" ` +
      `waitUrl="">${xmlEscape(conf)}</Conference>` +
    `</Dial>`,
  );
});
