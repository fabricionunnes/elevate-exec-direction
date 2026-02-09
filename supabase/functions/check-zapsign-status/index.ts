// check-zapsign-status - no external deps needed

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { documentToken } = await req.json();

    if (!documentToken) {
      return new Response(
        JSON.stringify({ error: "Missing documentToken" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Checking ZapSign document status:", documentToken);

    // Get document details from ZapSign
    const docResponse = await fetch(`https://api.zapsign.com.br/api/v1/docs/${documentToken}/`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${ZAPSIGN_API_TOKEN}`,
      },
    });

    const docResponseText = await docResponse.text();
    console.log("ZapSign response status:", docResponse.status);

    if (!docResponse.ok) {
      console.error("ZapSign API error:", docResponseText);
      return new Response(
        JSON.stringify({ 
          error: "Failed to get document from ZapSign", 
          details: docResponseText 
        }),
        { status: docResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Map signer status
    const signers = docData.signers?.map((s: any) => ({
      name: s.name,
      email: s.email,
      status: s.status,
      signedAt: s.signed_at,
      signUrl: s.sign_url,
    })) || [];

    const allSigned = signers.length > 0 && signers.every((s: any) => s.status === 'signed');
    const documentStatus = docData.status;

    console.log("Document status:", documentStatus, "All signed:", allSigned);

    return new Response(
      JSON.stringify({
        success: true,
        documentToken: docData.token,
        documentStatus,
        allSigned,
        signedFileUrl: allSigned ? docData.signed_file : null,
        originalFileUrl: docData.original_file,
        signers,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in check-zapsign-status function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
