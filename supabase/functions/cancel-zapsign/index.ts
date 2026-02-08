// cancel-zapsign - no external deps needed

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CancelZapSignRequest {
  documentToken: string;
}

serve(async (req) => {
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

    const { documentToken }: CancelZapSignRequest = await req.json();

    if (!documentToken) {
      return new Response(
        JSON.stringify({ error: "Missing documentToken" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Cancelling ZapSign document:", documentToken);

    // Cancel document in ZapSign
    // ZapSign API: DELETE /api/v1/docs/{token}/ or POST to cancel endpoint
    const cancelResponse = await fetch(`https://api.zapsign.com.br/api/v1/docs/${documentToken}/cancel/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ZAPSIGN_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const responseText = await cancelResponse.text();
    console.log("ZapSign cancel response status:", cancelResponse.status);
    console.log("ZapSign cancel response:", responseText);

    // Status 200 or 204 means success, 404 means document not found (already cancelled or doesn't exist)
    if (!cancelResponse.ok && cancelResponse.status !== 404) {
      console.error("ZapSign API error:", responseText);
      return new Response(
        JSON.stringify({ 
          error: "Failed to cancel document in ZapSign", 
          details: responseText 
        }),
        { status: cancelResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If 404, document was already cancelled or doesn't exist - that's okay
    if (cancelResponse.status === 404) {
      console.log("Document not found or already cancelled:", documentToken);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Documento não encontrado ou já foi cancelado anteriormente.",
          alreadyCancelled: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Documento cancelado com sucesso na ZapSign.",
        alreadyCancelled: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in cancel-zapsign function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
