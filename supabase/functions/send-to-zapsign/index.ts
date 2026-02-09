// send-to-zapsign - no external deps needed

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SignerInfo {
  name: string;
  email: string;
  phone?: string;
}

interface SendToZapSignRequest {
  pdfUrl: string;
  documentName: string;
  signers: SignerInfo[];
  sendAutomatically?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ZAPSIGN_API_TOKEN = Deno.env.get('ZAPSIGN_API_TOKEN');
    
    if (!ZAPSIGN_API_TOKEN) {
      console.error("ZAPSIGN_API_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "ZapSign API token not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { pdfUrl, documentName, signers, sendAutomatically = true }: SendToZapSignRequest = await req.json();

    console.log("Sending document to ZapSign:", { documentName, signers: signers.length, pdfUrl });

    if (!pdfUrl || !documentName || !signers || signers.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: pdfUrl, documentName, signers" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Create document via URL upload
    const createDocResponse = await fetch("https://api.zapsign.com.br/api/v1/docs/", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ZAPSIGN_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: documentName,
        url_pdf: pdfUrl,
        lang: "pt-br",
        disable_signer_emails: !sendAutomatically,
        signers: signers.map((signer, index) => ({
          name: signer.name,
          email: signer.email,
          phone_country: "55",
          phone_number: signer.phone?.replace(/\D/g, '') || "",
          auth_mode: "assinaturaTela",
          send_automatic_email: sendAutomatically,
          order_group: index + 1,
        })),
      }),
    });

    const docResponseText = await createDocResponse.text();
    console.log("ZapSign response status:", createDocResponse.status);
    console.log("ZapSign response:", docResponseText);

    if (!createDocResponse.ok) {
      console.error("ZapSign API error:", docResponseText);
      return new Response(
        JSON.stringify({ 
          error: "Failed to create document in ZapSign", 
          details: docResponseText 
        }),
        { status: createDocResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let docData;
    try {
      docData = JSON.parse(docResponseText);
    } catch (e) {
      console.error("Failed to parse ZapSign response:", e);
      return new Response(
        JSON.stringify({ error: "Invalid response from ZapSign" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Document created successfully:", docData.token);

    return new Response(
      JSON.stringify({
        success: true,
        documentToken: docData.token,
        documentUrl: `https://app.zapsign.com.br/verificar/${docData.token}`,
        signers: docData.signers?.map((s: any) => ({
          name: s.name,
          email: s.email,
          signUrl: s.sign_url,
          status: s.status,
        })) || [],
        message: sendAutomatically 
          ? "Documento enviado para assinatura! Os signatários receberão um e-mail com o link."
          : "Documento criado. Os links de assinatura estão disponíveis.",
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in send-to-zapsign function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
