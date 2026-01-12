import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.error('Evolution API credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Evolution API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const evolutionHeaders = {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
    };

    let body: any = {};
    if (req.method === 'POST') {
      body = await req.json();
    }

    console.log(`Evolution API action: ${action}`, body);

    switch (action) {
      case 'create-instance': {
        // Create a new WhatsApp instance
        const { instanceName, token: instanceToken, number, qrcode = true, integration = 'WHATSAPP-BAILEYS' } = body;
        
        if (!instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({
            instanceName,
            token: instanceToken,
            number,
            qrcode,
            integration,
          }),
        });

        const data = await response.json();
        console.log('Create instance response:', data);

        return new Response(
          JSON.stringify(data),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'connect': {
        // Connect an instance (get QR code)
        const { instanceName } = body;
        
        if (!instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers: evolutionHeaders,
        });

        const data = await response.json();
        console.log('Connect instance response:', data);

        return new Response(
          JSON.stringify(data),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'qr-code': {
        // Get QR code for an instance
        // Accept instanceName from query param OR body
        const instanceName = url.searchParams.get('instanceName') || body.instanceName;
        
        if (!instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName is required (query param or body)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers: evolutionHeaders,
        });

        const data = await response.json();
        console.log('QR code response:', data);

        return new Response(
          JSON.stringify(data),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'status': {
        // Check instance status
        // Accept instanceName from query param OR body
        const instanceName = url.searchParams.get('instanceName') || body.instanceName;
        
        if (!instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName is required (query param or body)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
          method: 'GET',
          headers: evolutionHeaders,
        });

        const data = await response.json();
        console.log('Status response:', data);

        return new Response(
          JSON.stringify(data),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list-instances': {
        // List all instances
        const response = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
          method: 'GET',
          headers: evolutionHeaders,
        });

        const data = await response.json();
        console.log('List instances response:', data);

        return new Response(
          JSON.stringify(data),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send-text': {
        // Send text message
        const { instanceName, number, text, delay } = body;
        
        if (!instanceName || !number || !text) {
          return new Response(
            JSON.stringify({ error: 'instanceName, number, and text are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({
            number,
            text,
            delay: delay || 0,
          }),
        });

        const data = await response.json();
        console.log('Send text response:', data);

        return new Response(
          JSON.stringify(data),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send-media': {
        // Send media (image, document, etc.)
        const { instanceName, number, mediatype, media, caption, fileName } = body;
        
        if (!instanceName || !number || !mediatype || !media) {
          return new Response(
            JSON.stringify({ error: 'instanceName, number, mediatype, and media are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`, {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({
            number,
            mediatype,
            media,
            caption: caption || '',
            fileName: fileName || '',
          }),
        });

        const data = await response.json();
        console.log('Send media response:', data);

        return new Response(
          JSON.stringify(data),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete-instance': {
        // Delete an instance
        const { instanceName } = body;
        
        if (!instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: evolutionHeaders,
        });

        const data = await response.json();
        console.log('Delete instance response:', data);

        return new Response(
          JSON.stringify(data),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'logout': {
        // Logout from an instance
        const { instanceName } = body;
        
        if (!instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
          method: 'DELETE',
          headers: evolutionHeaders,
        });

        const data = await response.json();
        console.log('Logout response:', data);

        return new Response(
          JSON.stringify(data),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'restart': {
        // Restart an instance
        const { instanceName } = body;
        
        if (!instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(`${EVOLUTION_API_URL}/instance/restart/${instanceName}`, {
          method: 'PUT',
          headers: evolutionHeaders,
        });

        const data = await response.json();
        console.log('Restart response:', data);

        return new Response(
          JSON.stringify(data),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ 
            error: 'Invalid action',
            availableActions: [
              'create-instance',
              'connect',
              'qr-code',
              'status',
              'list-instances',
              'send-text',
              'send-media',
              'delete-instance',
              'logout',
              'restart'
            ]
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Evolution API error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
