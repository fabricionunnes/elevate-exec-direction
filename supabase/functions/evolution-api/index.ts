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

    const fetchEvolutionJson = async (endpoint: string, init?: RequestInit) => {
      const fullUrl = `${EVOLUTION_API_URL}${endpoint}`;
      const res = await fetch(fullUrl, {
        ...init,
        headers: { ...evolutionHeaders, ...(init?.headers || {}) },
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }

      console.log('Evolution request:', { method: init?.method || 'GET', url: fullUrl, status: res.status });
      console.log('Evolution response:', json);

      return { res, json };
    };

    let body: any = {};
    if (req.method === 'POST') {
      body = await req.json();
    }

    console.log(`Evolution API action: ${action}`, body);

    switch (action) {
      case 'create-instance': {
        // Create a new WhatsApp instance
        const {
          instanceName,
          token: instanceToken,
          number,
          qrcode = true,
          integration = 'WHATSAPP-BAILEYS',
        } = body;

        if (!instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { res, json } = await fetchEvolutionJson('/instance/create', {
          method: 'POST',
          body: JSON.stringify({
            instanceName,
            token: instanceToken,
            number,
            qrcode,
            integration,
          }),
        });

        if (!res.ok) {
          return new Response(
            JSON.stringify({ error: 'Evolution create-instance failed', status: res.status, details: json }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(json),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'connect':
      case 'qr-code': {
        // Generate and return pairingCode/code for WhatsApp connection.
        // Accept instanceName from query param OR body.
        // Optional: accept 'number' (query/body) for setups that require it.
        const instanceName = url.searchParams.get('instanceName') || body.instanceName;
        const number = url.searchParams.get('number') || body.number;

        if (!instanceName) {
          return new Response(
            JSON.stringify({ error: 'instanceName is required (query param or body)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const doConnect = async (instanceRef: string) => {
          const qs = number ? `?number=${encodeURIComponent(number)}` : '';
          return fetchEvolutionJson(`/instance/connect/${encodeURIComponent(instanceRef)}${qs}`, {
            method: 'GET',
          });
        };

        // 1) Try by instanceName
        let { res: connectRes, json: connectJson } = await doConnect(instanceName);

        // If Evolution returns count=0, it often means the instance reference is not what the server expects.
        // 2) Fallback: resolve instanceId via fetchInstances and try again.
        const connectCount = typeof connectJson?.count === 'number' ? connectJson.count : null;
        if ((connectRes.status === 404 || connectCount === 0) && instanceName) {
          const { res: listRes, json: listJson } = await fetchEvolutionJson('/instance/fetchInstances', { method: 'GET' });

          if (listRes.ok && Array.isArray(listJson)) {
            // Evolution installations differ:
            // - v2 docs: [{ instance: { instanceName, instanceId } }]
            // - some servers: [{ id, name }]
            const match =
              listJson.find((x: any) => x?.instance?.instanceName === instanceName) ||
              listJson.find((x: any) => x?.name === instanceName);

            const instanceId = match?.instance?.instanceId || match?.id;

            if (instanceId) {
              console.log('Resolved instanceId for connect fallback:', { instanceName, instanceId });
              ({ res: connectRes, json: connectJson } = await doConnect(instanceId));
            }
          }
        }

        return new Response(
          JSON.stringify(connectJson),
          { status: connectRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

        const { res, json } = await fetchEvolutionJson(
          `/instance/connectionState/${encodeURIComponent(instanceName)}`,
          { method: 'GET' }
        );

        return new Response(
          JSON.stringify(json),
          { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list-instances': {
        // List all instances
        const { res, json } = await fetchEvolutionJson('/instance/fetchInstances', { method: 'GET' });

        return new Response(
          JSON.stringify(json),
          { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
